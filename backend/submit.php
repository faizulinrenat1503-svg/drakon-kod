<?php
/**
 * Обработчик формы заявки «Дракон.Код».
 * Схема та же, что на сайте dragon-trade: сайт отправляет JSON через fetch,
 * обработчик проверяет адрес сайта (CORS), очищает поля, сохраняет заявку
 * в MySQL (если база настроена) и отправляет письмо через SMTP.
 *
 * Сбой базы НЕ мешает отправке письма: заявка считается принятой,
 * если удалось хотя бы одно — записать в базу или отправить письмо.
 *
 * Ответ: {"success": true} или {"success": false, "error": "..."}.
 *
 * Файлы рядом с этим:
 *   config.php   — пароли базы и почты (НЕ в git, загружается на сервер вручную,
 *                  образец — config.example.php);
 *   origins.php  — разрешённые адреса сайта, генерируется при сборке
 *                  (npm run build) из src/_data/site.js.
 */

declare(strict_types=1);

const ERROR_LOG_FILE = __DIR__ . '/errors-log.php';
// Лог — .php-файл с «заглушкой» в начале: сервер его выполняет, а не отдаёт
// как текст, поэтому содержимое лога нельзя прочитать по HTTP.
const ERROR_LOG_GUARD = "<?php http_response_code(403); exit; ?>\n";

function log_error(string $message): void
{
    if (!file_exists(ERROR_LOG_FILE)) {
        @file_put_contents(ERROR_LOG_FILE, ERROR_LOG_GUARD, LOCK_EX);
    }
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    @file_put_contents(ERROR_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

function send_json(bool $success, ?string $error = null): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        $success ? ['success' => true] : ['success' => false, 'error' => $error],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

$configFile = __DIR__ . '/config.php';
$originsFile = __DIR__ . '/origins.php';
if (!is_file($configFile) || !is_file($originsFile)) {
    http_response_code(500);
    log_error('config.php или origins.php не найден');
    send_json(false, 'Server misconfigured');
}
$config = require $configFile;
$allowedOrigins = require $originsFile;

/**
 * Минимальный SMTP-клиент без зависимостей (как в dragon-trade): неявный TLS,
 * AUTH LOGIN, одно текстовое письмо. Каждый сбой пишет ответ сервера в лог.
 */
function send_via_smtp(string $host, int $port, string $user, string $pass, string $from, string $to, string $subject, string $body): bool
{
    $socket = @stream_socket_client("ssl://{$host}:{$port}", $errno, $errstr, 15);
    if (!$socket) {
        log_error("SMTP connect failed: {$errstr} ({$errno})");
        return false;
    }
    stream_set_timeout($socket, 15);

    $readResponse = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 515)) !== false) {
            $data .= $line;
            // В последней строке ответа на 4-й позиции пробел, в промежуточных — дефис.
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $step = function (string $line, string $expectedCode) use ($socket, $readResponse): bool {
        if ($line !== '') {
            fwrite($socket, $line . "\r\n");
        }
        $response = $readResponse();
        if (!str_starts_with($response, $expectedCode)) {
            log_error("SMTP step failed (expected {$expectedCode}): " . trim($response));
            return false;
        }
        return true;
    };

    $ehloHost = substr(strrchr($from, '@') ?: '@localhost', 1);
    $steps = [
        ['', '220'],
        ["EHLO {$ehloHost}", '250'],
        ['AUTH LOGIN', '334'],
        [base64_encode($user), '334'],
        [base64_encode($pass), '235'],
        ["MAIL FROM:<{$from}>", '250'],
        ["RCPT TO:<{$to}>", '250'],
        ['DATA', '354'],
    ];
    foreach ($steps as [$line, $expectedCode]) {
        if (!$step($line, $expectedCode)) {
            fclose($socket);
            return false;
        }
    }

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encodedName = '=?UTF-8?B?' . base64_encode('Дракон.Код') . '?=';
    $message = "From: {$encodedName} <{$from}>\r\n"
        . "To: <{$to}>\r\n"
        . "Subject: {$encodedSubject}\r\n"
        . 'Date: ' . date('r') . "\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "\r\n"
        . chunk_split(base64_encode($body))
        . "\r\n.";
    if (!$step($message, '250')) {
        fclose($socket);
        return false;
    }

    fwrite($socket, "QUIT\r\n");
    fclose($socket);
    return true;
}

// ---------------------------------------------------------------------
// CORS — принимаем заявки только с адресов сайта (список — в origins.php).
// ---------------------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originAllowed = in_array($origin, $allowedOrigins, true);

header('Vary: Origin');
if ($originAllowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code($originAllowed ? 204 : 403);
    exit;
}

if (!$originAllowed) {
    log_error('Rejected request from disallowed origin: ' . ($origin !== '' ? $origin : '(none)'));
    send_json(false, 'Forbidden origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send_json(false, 'Method not allowed');
}

// ---------------------------------------------------------------------
// Входные данные — обычный POST или JSON (сайт отправляет JSON).
// ---------------------------------------------------------------------
$input = $_POST;
if (empty($input)) {
    $raw = file_get_contents('php://input');
    if ($raw !== false && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $input = $decoded;
        }
    }
}

// Убирает теги и управляющие символы, обрезает длину — защита от XSS в письме
// и базе (плюс подготовленные запросы PDO против SQL-инъекций).
function clean_field(mixed $value, int $maxLen): string
{
    $value = is_string($value) ? $value : '';
    $value = trim($value);
    $value = strip_tags($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr($value, 0, $maxLen);
}

// Honeypot: скрытое поле заполняют только боты. Отвечаем «успехом»,
// чтобы бот не пробовал снова, но ничего не сохраняем и не отправляем.
if (clean_field($input['website'] ?? '', 200) !== '') {
    log_error('Honeypot triggered, request ignored');
    send_json(true);
}

$name = clean_field($input['name'] ?? '', 200);
$phone = clean_field($input['phone'] ?? '', 50);
$productGroup = clean_field($input['product_group'] ?? '', 100);
$comment = clean_field($input['comment'] ?? '', 2000);
$pageUrl = clean_field($input['page'] ?? '', 500);
$pageTitle = clean_field($input['page_title'] ?? '', 300);

if ($name === '' || $phone === '') {
    send_json(false, 'Missing required fields');
}
if (!preg_match('/^[0-9+()\-\s]{5,50}$/u', $phone)) {
    send_json(false, 'Invalid phone format');
}

// ---------------------------------------------------------------------
// База данных — необязательна. Если блока 'db' в config.php нет или база
// недоступна, заявка всё равно уходит письмом.
// ---------------------------------------------------------------------
$savedToDb = false;
if (!empty($config['db']['name'])) {
    try {
        $db = $config['db'];
        $dsn = 'mysql:host=' . $db['host'] . ';port=' . $db['port'] . ';dbname=' . $db['name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);

        // Отдельная таблица для «Дракон.Код» — не пересекается с заявками dragon-trade.
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS drakon_kod_leads (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                product_group VARCHAR(100) NULL,
                comment TEXT NULL,
                page_url VARCHAR(500) NULL,
                page_title VARCHAR(300) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );

        $stmt = $pdo->prepare(
            'INSERT INTO drakon_kod_leads (name, phone, product_group, comment, page_url, page_title)
             VALUES (:name, :phone, :product_group, :comment, :page_url, :page_title)'
        );
        $stmt->execute([
            ':name' => $name,
            ':phone' => $phone,
            ':product_group' => $productGroup,
            ':comment' => $comment,
            ':page_url' => $pageUrl,
            ':page_title' => $pageTitle,
        ]);
        $savedToDb = true;
    } catch (Throwable $e) {
        log_error('DB error (письмо всё равно отправляется): ' . $e->getMessage());
    }
}

// ---------------------------------------------------------------------
// Письмо о новой заявке.
// ---------------------------------------------------------------------
$mailSent = false;
try {
    $subject = 'Новая заявка с сайта Дракон.Код';
    $body = "Имя: {$name}\n"
        . "Телефон: {$phone}\n"
        . 'Товарная группа: ' . ($productGroup !== '' ? $productGroup : '—') . "\n"
        . 'Комментарий: ' . ($comment !== '' ? $comment : '—') . "\n"
        . "Страница: {$pageTitle}\n"
        . "Адрес страницы: {$pageUrl}\n"
        . 'Дата: ' . date('Y-m-d H:i:s') . "\n"
        . 'Сохранено в базе: ' . ($savedToDb ? 'да' : 'нет');

    $smtp = $config['smtp'];
    $mailSent = send_via_smtp(
        $smtp['host'],
        (int) $smtp['port'],
        $smtp['user'],
        $smtp['pass'],
        $smtp['user'],
        $config['notify_email'],
        $subject,
        $body
    );
    if ($mailSent) {
        log_error('SMTP: message accepted by ' . $smtp['host'] . ' for delivery to ' . $config['notify_email']);
    } else {
        log_error('SMTP notification send failed for a new lead (see SMTP step log above)');
    }
} catch (Throwable $e) {
    log_error('Mail error: ' . $e->getMessage());
}

if (!$savedToDb && !$mailSent) {
    // Заявка потеряна бы — пишем её в лог целиком, чтобы можно было перезвонить.
    log_error("LEAD NOT DELIVERED: {$name} | {$phone} | {$productGroup} | {$comment} | {$pageUrl}");
    send_json(false, 'Internal error, please try again later');
}

send_json(true);
