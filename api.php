<?php
/* ====== DEBUG (disable in production) ====== */
error_reporting(E_ALL);
ini_set("display_errors", 1);

/* ====== DB CONFIG ====== */
$DB_HOST = "localhost";
$DB_USER = "root";
$DB_PASS = "";
$DB_NAME = "school_db";

/* ====== CONNECT ====== */
$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($conn->connect_error) {
  header("Content-Type: application/json");
  http_response_code(500);
  echo json_encode(["error"=>"DB connection failed"]);
  exit;
}

$action = $_GET['action'] ?? '';
/* JSON by default */
if (!headers_sent() && strpos($action, 'export') === false) {
  header("Content-Type: application/json");
}

/* ====== HELPERS ====== */
function get_json() {
  $raw = file_get_contents("php://input");
  return json_decode($raw, true) ?: [];
}
function ok($arr){ echo json_encode($arr); exit; }
function ok_msg($msg){ ok(["message"=>$msg]); }

/* Ensure tables exist and correct schema */
function ensure_tables($conn){
  $conn->query("CREATE TABLE IF NOT EXISTS students(
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    class VARCHAR(50),
    age INT,
    fees DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB");

  $conn->query("CREATE TABLE IF NOT EXISTS teachers(
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    subject VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB");

  $conn->query("CREATE TABLE IF NOT EXISTS books(
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200),
    author VARCHAR(100),
    status ENUM('available','issued') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB");

  $conn->query("CREATE TABLE IF NOT EXISTS fees(
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    month VARCHAR(7),
    amount DECIMAL(10,2),
    status ENUM('paid','unpaid') DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  ) ENGINE=InnoDB");

  $conn->query("CREATE TABLE IF NOT EXISTS results(
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    subject VARCHAR(100),
    marks INT,
    grade VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  ) ENGINE=InnoDB");

  $conn->query("CREATE TABLE IF NOT EXISTS timetable(
    id INT AUTO_INCREMENT PRIMARY KEY,
    class VARCHAR(50),
    subject VARCHAR(100),
    day VARCHAR(20),
    time VARCHAR(20),
    teacher_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB");
}
ensure_tables($conn);

/* ====== ROUTES ====== */
switch ($action) {
  /* --- STATS --- */
  case 'get_stats':
    $r1 = $conn->query("SELECT COUNT(*) c FROM students")->fetch_assoc()['c'] ?? 0;
    $r2 = $conn->query("SELECT COUNT(*) c FROM teachers")->fetch_assoc()['c'] ?? 0;
    $r3 = $conn->query("SELECT COUNT(*) c FROM books")->fetch_assoc()['c'] ?? 0;
    $r4 = $conn->query("SELECT COUNT(*) c FROM fees WHERE status='unpaid'")->fetch_assoc()['c'] ?? 0;
    ok([
      "students" => (int)$r1,
      "teachers" => (int)$r2,
      "books"    => (int)$r3,
      "unpaid_fees" => (int)$r4
    ]);
    break;

  /* --- MONTHLY RECORDS (legacy name) --- */
  case 'get_monthly_records':
    $students = [];
    $q = $conn->query("SELECT DATE_FORMAT(created_at,'%Y-%m') m, COUNT(*) c FROM students GROUP BY m");
    while ($row = $q->fetch_assoc()) $students[$row['m']] = (int)$row['c'];

    $teachers = [];
    $q = $conn->query("SELECT DATE_FORMAT(created_at,'%Y-%m') m, COUNT(*) c FROM teachers GROUP BY m");
    while ($row = $q->fetch_assoc()) $teachers[$row['m']] = (int)$row['c'];

    $unpaid = [];
    $q = $conn->query("SELECT DATE_FORMAT(created_at,'%Y-%m') m, COUNT(*) c FROM fees WHERE status='unpaid' GROUP BY m");
    while ($row = $q->fetch_assoc()) $unpaid[$row['m']] = (int)$row['c'];

    $months = array_unique(array_merge(array_keys($students), array_keys($teachers), array_keys($unpaid)));
    sort($months);
    $out = [];
    foreach ($months as $m) {
      $out[] = [
        "month" => $m,
        "students" => $students[$m] ?? 0,
        "teachers" => $teachers[$m] ?? 0,
        "unpaid" => $unpaid[$m] ?? 0
      ];
    }
    ok($out);
    break;

  /* --- STUDENTS --- */
  case 'get_students':
    $res = $conn->query("SELECT * FROM students ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_student': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO students(name,class,age,fees) VALUES (?,?,?,?)");
    $stmt->bind_param("ssid", $d['name'], $d['class'], $d['age'], $d['fees']);
    $stmt->execute();
    ok_msg("Student added");
    break;
  }

  case 'update_student': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE students SET name=?, class=?, age=?, fees=? WHERE id=?");
    $stmt->bind_param("ssidi", $d['name'], $d['class'], $d['age'], $d['fees'], $d['id']);
    $stmt->execute();
    ok_msg("Student updated");
    break;
  }

  case 'delete_student': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM students WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Student deleted");
    break;
  }

  case 'update_fee': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE students SET fees=? WHERE id=?");
    $stmt->bind_param("di", $d['fees'], $d['id']);
    $stmt->execute();
    ok_msg("Fee updated");
    break;
  }

  /* --- TEACHERS --- */
  case 'get_teachers':
    $res = $conn->query("SELECT * FROM teachers ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_teacher': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO teachers(name,subject) VALUES (?,?)");
    $stmt->bind_param("ss", $d['name'], $d['subject']);
    $stmt->execute();
    ok_msg("Teacher added");
    break;
  }

  case 'update_teacher': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE teachers SET name=?, subject=? WHERE id=?");
    $stmt->bind_param("ssi", $d['name'], $d['subject'], $d['id']);
    $stmt->execute();
    ok_msg("Teacher updated");
    break;
  }

  case 'delete_teacher': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM teachers WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Teacher deleted");
    break;
  }

  /* --- BOOKS (LIBRARY) --- */
  case 'get_books':
    $res = $conn->query("SELECT * FROM books ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_book': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO books(title,author,status) VALUES (?,?,?)");
    $stmt->bind_param("sss", $d['title'], $d['author'], $d['status']);
    $stmt->execute();
    ok_msg("Book added");
    break;
  }

  case 'update_book': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE books SET title=?, author=?, status=? WHERE id=?");
    $stmt->bind_param("sssi", $d['title'], $d['author'], $d['status'], $d['id']);
    $stmt->execute();
    ok_msg("Book updated");
    break;
  }

  case 'delete_book': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM books WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Book deleted");
    break;
  }

  /* --- FEES (MONTHLY RECORDS TABLE) --- */
  case 'get_fees':
    $res = $conn->query("SELECT * FROM fees ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_fee_record': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO fees(student_id,month,amount,status) VALUES (?,?,?,?)");
    $stmt->bind_param("isds", $d['student_id'], $d['month'], $d['amount'], $d['status']);
    $stmt->execute();
    ok_msg("Fee record added");
    break;
  }

  case 'update_fee_record': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE fees SET student_id=?, month=?, amount=?, status=? WHERE id=?");
    $stmt->bind_param("isdsi", $d['student_id'], $d['month'], $d['amount'], $d['status'], $d['id']);
    $stmt->execute();
    ok_msg("Fee record updated");
    break;
  }

  case 'delete_fee': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM fees WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Fee record deleted");
    break;
  }

  /* --- RESULTS --- */
  case 'get_results':
    $res = $conn->query("SELECT * FROM results ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_result': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO results(student_id,subject,marks,grade) VALUES (?,?,?,?)");
    $stmt->bind_param("isis", $d['student_id'], $d['subject'], $d['marks'], $d['grade']);
    $stmt->execute();
    ok_msg("Result added");
    break;
  }

  case 'update_result': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE results SET student_id=?, subject=?, marks=?, grade=? WHERE id=?");
    $stmt->bind_param("isisi", $d['student_id'], $d['subject'], $d['marks'], $d['grade'], $d['id']);
    $stmt->execute();
    ok_msg("Result updated");
    break;
  }

  case 'delete_result': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM results WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Result deleted");
    break;
  }

  /* --- TIMETABLE --- */
  case 'get_timetable':
    $res = $conn->query("SELECT * FROM timetable ORDER BY id DESC");
    ok($res->fetch_all(MYSQLI_ASSOC));
    break;

  case 'add_timetable': {
    $d = get_json();
    $stmt = $conn->prepare("INSERT INTO timetable(class,subject,day,time,teacher_id) VALUES (?,?,?,?,?)");
    $stmt->bind_param("ssssi", $d['class'], $d['subject'], $d['day'], $d['time'], $d['teacher_id']);
    $stmt->execute();
    ok_msg("Schedule added");
    break;
  }

  case 'update_timetable': {
    $d = get_json();
    $stmt = $conn->prepare("UPDATE timetable SET class=?, subject=?, day=?, time=?, teacher_id=? WHERE id=?");
    $stmt->bind_param("ssssii", $d['class'], $d['subject'], $d['day'], $d['time'], $d['teacher_id'], $d['id']);
    $stmt->execute();
    ok_msg("Schedule updated");
    break;
  }

  case 'delete_timetable': {
    $id = (int)($_GET['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM timetable WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    ok_msg("Schedule deleted");
    break;
  }

  /* --- UNPAID STUDENTS --- */
  case 'get_unpaid_students':
    $q = $conn->query("
      SELECT s.id, s.name, s.class, COALESCE(SUM(f.amount),0) as total_unpaid
      FROM students s
      JOIN fees f ON f.student_id = s.id
      WHERE f.status='unpaid'
      GROUP BY s.id, s.name, s.class
      ORDER BY total_unpaid DESC, s.name
    ");
    ok($q->fetch_all(MYSQLI_ASSOC));
    break;

  /* --- MONTHLY REPORT (for modal) --- */
  case 'get_monthly_report':
    $q = $conn->query("SELECT month,
      COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status='paid' THEN 1 END) as paid_count,
      SUM(amount) as total_amount
      FROM fees GROUP BY month ORDER BY month");
    ok($q->fetch_all(MYSQLI_ASSOC));
    break;

  /* --- EXPORTS --- */
  case 'export_monthly_excel': {
    header("Content-Type: application/vnd.ms-excel");
    header("Content-Disposition: attachment; filename=monthly_fees_report.xls");

    $q = $conn->query("SELECT month,
      COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status='paid' THEN 1 END) as paid_count,
      SUM(amount) as total_amount
      FROM fees GROUP BY month ORDER BY month");

    echo "Month\tUnpaid\tPaid\tTotal Amount\n";
    while ($row = $q->fetch_assoc()) {
      echo "{$row['month']}\t{$row['unpaid_count']}\t{$row['paid_count']}\t{$row['total_amount']}\n";
    }
    exit;
  }
case 'export_fees_report': {
    require("fpdf.php");

    $month = $_GET['month'] ?? date("Y-m");
    $schoolName = "🏫 My School Name"; // change to your school
    $logo = __DIR__ . "/logo.png";     // optional, place a logo.png in root

    // Fetch fees data
    $stmt = $conn->prepare("
      SELECT s.name, f.month, f.amount, f.status
      FROM fees f
      JOIN students s ON f.student_id = s.id
      WHERE f.month = ?
      ORDER BY s.name ASC
    ");
    $stmt->bind_param("s", $month);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = $res->fetch_all(MYSQLI_ASSOC);

    // Init PDF
    $pdf = new FPDF();
    $pdf->AddPage();
    $pdf->SetFont("Arial","B",14);

    // Logo
    if (file_exists($logo)) {
        $pdf->Image($logo,10,6,20);
    }
    $pdf->Cell(0,10,$schoolName,0,1,"C");
    $pdf->Ln(5);

    $pdf->SetFont("Arial","B",12);
    $pdf->Cell(0,10,"Monthly Fees Report - $month",0,1,"C");
    $pdf->Ln(5);

    // Table header
    $pdf->SetFont("Arial","B",10);
    $pdf->Cell(60,10,"Student",1);
    $pdf->Cell(40,10,"Month",1);
    $pdf->Cell(40,10,"Amount",1);
    $pdf->Cell(40,10,"Status",1);
    $pdf->Ln();

    $pdf->SetFont("Arial","",10);
    $total = 0; $unpaid = 0;
    foreach ($rows as $r) {
        $pdf->Cell(60,10,$r['name'],1);
        $pdf->Cell(40,10,$r['month'],1);
        $pdf->Cell(40,10,$r['amount'],1,0,"R");
        $pdf->Cell(40,10,ucfirst($r['status']),1);
        $pdf->Ln();
        $total += $r['amount'];
        if ($r['status'] === "unpaid") $unpaid += $r['amount'];
    }

    // Totals
    $pdf->SetFont("Arial","B",10);
    $pdf->Cell(100,10,"Total Collected:",1);
    $pdf->Cell(80,10,($total - $unpaid)." / $total",1,0,"R");

    $pdf->Output("I","fees_report_$month.pdf");
    exit;
}
  /* --- UNPAID STUDENTS LIST --- */
  case 'get_unpaid_students': {
    $res = $conn->query("
      SELECT s.id, s.name, s.class, f.month, f.amount 
      FROM fees f 
      JOIN students s ON f.student_id = s.id 
      WHERE f.status='unpaid'
      ORDER BY f.month DESC, s.name ASC
    ");
    ok($res->fetch_all(MYSQLI_ASSOC));
  }

  case 'export_monthly_pdf': {
    /* PDF requires FPDF library (place fpdf.php in project) */
    require_once("fpdf.php");
    $pdf = new FPDF();
    $pdf->AddPage();
    $pdf->SetFont("Arial","B",16);
    $pdf->Cell(0,10,"Monthly Fee Report",0,1,"C");
    $pdf->SetFont("Arial","B",12);
    $pdf->Cell(40,10,"Month",1);
    $pdf->Cell(40,10,"Unpaid",1);
    $pdf->Cell(40,10,"Paid",1);
    $pdf->Cell(60,10,"Total Amount",1);
    $pdf->Ln();

    $q = $conn->query("SELECT month,
      COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status='paid' THEN 1 END) as paid_count,
      SUM(amount) as total_amount
      FROM fees GROUP BY month ORDER BY month");

    $pdf->SetFont("Arial","",12);
    while ($row = $q->fetch_assoc()) {
      $pdf->Cell(40,10,$row['month'],1);
      $pdf->Cell(40,10,$row['unpaid_count'],1);
      $pdf->Cell(40,10,$row['paid_count'],1);
      $pdf->Cell(60,10,$row['total_amount'],1);
      $pdf->Ln();
    }
    $pdf->Output();
    exit;
  }
  

  default:
    ok(["message"=>"No valid action"]);
}
/* never reached */
?>
