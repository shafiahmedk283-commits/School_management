/* ============== STATE ============== */
let allStudents = [];
let allTeachers = [];
let allBooks = [];
let allFees = [];
let allResults = [];
let allTimetable = [];

/* ============== UTIL ============== */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function showSection(id){
  qsa(".page-section").forEach(s => s.style.display = "none");
  const node = qs("#" + id);
  if(node) node.style.display = "block";
}

/* small helper to avoid XSS when injecting values */
function escapeHtml(str){
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* Modal helpers (single container) */
function openModal(title, innerFormHTML){
  const html = `
    <div class="modal" id="__modal" style="display:flex;align-items:center;justify-content:center;">
      <div class="modal-content">
        <span class="close" onclick="closeModal()">&times;</span>
        <h3>${escapeHtml(title)}</h3>
        ${innerFormHTML}
      </div>
    </div>`;
  qs("#modalContainer").innerHTML = html;
}
function closeModal(){
  qs("#modalContainer").innerHTML = "";
}

/* Render helper for generic table */
function renderTable(containerId, headers, rowsHTML){
  const container = qs("#" + containerId);
  if(!container) return;
  container.innerHTML = `
    <div class="table-container">
      <table class="styled-table">
        <thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  `;
}

/* ============== DASHBOARD ============== */
async function loadStats(){
  try{
    const res = await fetch("api.php?action=get_stats");
    const s = await res.json();
    qs("#statStudents").innerText = s.students || 0;
    qs("#statTeachers").innerText = s.teachers || 0;
    qs("#statBooks").innerText = s.books || 0;
    qs("#statUnpaid").innerText = s.unpaid_fees || 0;
  }catch(e){
    console.error("Failed to load stats", e);
  }

  // unpaid students list
  loadUnpaidStudents();
}

/* Unpaid students render */
async function loadUnpaidStudents(){
  try{
    const res = await fetch("api.php?action=get_unpaid_students");
    const list = await res.json();
    const rows = list.map(s => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.class)}</td>
        <td>${escapeHtml(s.total_unpaid)}</td>
        <td>
          <button class="btn-primary" onclick="openFeeQuickById(${s.id})">Update Fee</button>
        </td>
      </tr>
    `).join("");
    renderTable("unpaidStudentsList", ["Name","Class","Total Unpaid","Actions"], rows);
  }catch(e){
    console.error("Failed to load unpaid students", e);
    qs("#unpaidStudentsList").innerHTML = "<div>Error loading unpaid students</div>";
  }
}

/* Fee-per-month modal (fetches get_monthly_report) */
async function showMonthlyFeesReport(){
  try{
    const res = await fetch("api.php?action=get_monthly_report");
    const data = await res.json();
    const rows = data.map(r => `
      <tr>
        <td>${escapeHtml(r.month)}</td>
        <td>${escapeHtml(r.unpaid_count)}</td>
        <td>${escapeHtml(r.paid_count)}</td>
        <td>${escapeHtml((Number(r.total_amount)||0).toFixed(2))}</td>
      </tr>
    `).join("");
    const html = `<div class="table-container"><table class="styled-table">
      <thead><tr><th>Month</th><th>Unpaid Count</th><th>Paid Count</th><th>Total Amount</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    qs("#monthlyFeesTable").innerHTML = html;
    qs("#monthlyFeesModal").style.display = "block";
  }catch(e){
    console.error("Failed to load monthly fees report", e);
    qs("#monthlyFeesTable").innerHTML = "<div>Error loading report</div>";
    qs("#monthlyFeesModal").style.display = "block";
  }
}
function closeMonthlyFees(){
  qs("#monthlyFeesModal").style.display = "none";
}
function exportExcel(){ window.location.href = "api.php?action=export_monthly_excel"; }
function exportPDF(){ window.location.href = "api.php?action=export_monthly_pdf"; }

/* Monthly records (existing) */
async function showMonthlyRecords(){
  try{
    const res = await fetch("api.php?action=get_monthly_records");
    const data = await res.json();
    const rows = data.map(r => `
      <tr>
        <td>${escapeHtml(r.month)}</td>
        <td>${escapeHtml(r.students)}</td>
        <td>${escapeHtml(r.teachers)}</td>
        <td>${escapeHtml(r.unpaid)}</td>
      </tr>
    `).join("");
    const html = `<div class="table-container"><table class="styled-table">
      <thead><tr><th>Month</th><th>Total Students</th><th>Total Teachers</th><th>Unpaid Fees</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    openModal("📅 Monthly Records", html);
  }catch(e){
    console.error("Failed to load monthly records", e);
    openModal("📅 Monthly Records", "<div>Error loading monthly records</div>");
  }
}

/* ============== STUDENTS ============== */
async function loadStudents(){
  try{
    const res = await fetch("api.php?action=get_students");
    allStudents = await res.json();
    qs("#statStudents").innerText = allStudents.length;
    renderStudents(allStudents);
  }catch(e){
    console.error("Failed to load students", e);
  }
}
function renderStudents(list){
  const rows = list.map(s => `
    <tr>
      <td>${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.class)}</td>
      <td>${escapeHtml(s.age)}</td>
      <td>${escapeHtml(s.fees ?? 0)}</td>
      <td>
        <button class="btn-primary edit-student" data-id="${s.id}">Edit</button>
        <button class="btn-primary delete-student" data-id="${s.id}">Delete</button>
        <button class="btn-primary fee-student" data-id="${s.id}">Fee</button>
      </td>
    </tr>
  `).join("");
  renderTable("studentsList",
    ["ID","Name","Class","Age","Fees","Actions"], rows);

  qsa("#studentsList .edit-student").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const s = allStudents.find(x => Number(x.id) === id);
      openStudentForm(s);
    });
  });
  qsa("#studentsList .delete-student").forEach(btn=>{
    btn.addEventListener('click', () => deleteStudent(Number(btn.dataset.id)));
  });
  qsa("#studentsList .fee-student").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const s = allStudents.find(x => Number(x.id) === id);
      openFeeQuick(s);
    });
  });
}
function filterStudents(){
  const q = (qs("#searchStudents").value || "").toLowerCase();
  const filtered = allStudents.filter(s =>
    (s.name || "").toLowerCase().includes(q) ||
    (s.class || "").toLowerCase().includes(q) ||
    String(s.age).includes(q) ||
    String(s.fees ?? "").includes(q)
  );
  renderStudents(filtered);
}
function openStudentForm(s=null){
  openModal(s? "Edit Student" : "Add Student", `
    <form id="studentForm">
      <input type="hidden" id="student_id" value="${s? escapeHtml(s.id) : ""}">
      <label>Name</label>
      <input type="text" id="student_name" value="${s? escapeHtml(s.name) : ""}" required>
      <label>Class</label>
      <input type="text" id="student_class" value="${s? escapeHtml(s.class) : ""}" required>
      <label>Age</label>
      <input type="number" id="student_age" value="${s? escapeHtml(s.age) : ""}" required>
      <label>Fees (due)</label>
      <input type="number" id="student_fees" value="${s? escapeHtml(s.fees ?? 0) : 0}">
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);

  const form = qs("#studentForm");
  if(form) form.addEventListener("submit", saveStudent);
}
async function saveStudent(e){
  e.preventDefault();
  const id = qs("#student_id").value.trim();
  const payload = {
    id,
    name: qs("#student_name").value.trim(),
    class: qs("#student_class").value.trim(),
    age: Number(qs("#student_age").value),
    fees: Number(qs("#student_fees").value||0)
  };
  const action = id ? "update_student" : "add_student";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadStudents();
    loadStats();
  }catch(err){
    console.error("Failed saving student", err);
  }
}
async function deleteStudent(id){
  if(!confirm("Delete this student?")) return;
  try{
    await fetch(`api.php?action=delete_student&id=${id}`);
    loadStudents();
    loadStats();
  }catch(e){
    console.error("Failed to delete student", e);
  }
}
/* Quick fee button on student row */
function openFeeQuick(s){
  openModal(`Update Fee for ${escapeHtml(s.name)}`, `
    <form id="feeQuickForm">
      <input type="hidden" id="student_id" value="${escapeHtml(s.id)}">
      <label>Current Due</label>
      <input type="number" id="student_fees" value="${escapeHtml(s.fees ?? 0)}" required>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Update</button>
      </div>
    </form>
  `);
  const form = qs("#feeQuickForm");
  if(form) form.addEventListener("submit", saveStudentFeeOnly);
}
function openFeeQuickById(id){
  // fetch fresh student then open quick fee
  const s = allStudents.find(x => Number(x.id) === Number(id));
  if(s) openFeeQuick(s);
}
async function saveStudentFeeOnly(e){
  e.preventDefault();
  const id = Number(qs("#student_id").value);
  const fees = Number(qs("#student_fees").value||0);
  try{
    await fetch("api.php?action=update_fee", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ id, fees })
    });
    closeModal();
    loadStudents();
    loadStats();
    loadUnpaidStudents();
  }catch(err){
    console.error("Failed to update fee", err);
  }
}

/* ============== TEACHERS ============== */
async function loadTeachers(){
  try{
    const res = await fetch("api.php?action=get_teachers");
    allTeachers = await res.json();
    qs("#statTeachers").innerText = allTeachers.length;
    renderTeachers(allTeachers);
  }catch(e){
    console.error("Failed to load teachers", e);
  }
}
function renderTeachers(list){
  const rows = list.map(t => `
    <tr>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.subject)}</td>
      <td>
        <button class="btn-primary edit-teacher" data-id="${t.id}">Edit</button>
        <button class="btn-primary delete-teacher" data-id="${t.id}">Delete</button>
      </td>
    </tr>
  `).join("");
  renderTable("teachersList", ["ID","Name","Subject","Actions"], rows);

  qsa("#teachersList .edit-teacher").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const t = allTeachers.find(x => Number(x.id) === id);
      openTeacherForm(t);
    });
  });
  qsa("#teachersList .delete-teacher").forEach(btn=>{
    btn.addEventListener('click', () => deleteTeacher(Number(btn.dataset.id)));
  });
}
function filterTeachers(){
  const q = (qs("#searchTeachers").value || "").toLowerCase();
  const filtered = allTeachers.filter(t =>
    (t.name || "").toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q)
  );
  renderTeachers(filtered);
}
function openTeacherForm(t=null){
  openModal(t? "Edit Teacher" : "Add Teacher", `
    <form id="teacherForm">
      <input type="hidden" id="teacher_id" value="${t? escapeHtml(t.id) : ""}">
      <label>Name</label>
      <input type="text" id="teacher_name" value="${t? escapeHtml(t.name) : ""}" required>
      <label>Subject</label>
      <input type="text" id="teacher_subject" value="${t? escapeHtml(t.subject) : ""}" required>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
  const form = qs("#teacherForm");
  if(form) form.addEventListener("submit", saveTeacher);
}
async function saveTeacher(e){
  e.preventDefault();
  const id = qs("#teacher_id").value.trim();
  const payload = {
    id,
    name: qs("#teacher_name").value.trim(),
    subject: qs("#teacher_subject").value.trim()
  };
  const action = id ? "update_teacher" : "add_teacher";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadTeachers();
    loadStats();
  }catch(err){
    console.error("Failed saving teacher", err);
  }
}
async function deleteTeacher(id){
  if(!confirm("Delete this teacher?")) return;
  try{
    await fetch(`api.php?action=delete_teacher&id=${id}`);
    loadTeachers();
    loadStats();
    loadTimetable();
  }catch(e){
    console.error("Failed to delete teacher", e);
  }
}

/* ============== BOOKS ============== */
async function loadBooks(){
  try{
    const res = await fetch("api.php?action=get_books");
    allBooks = await res.json();
    qs("#statBooks").innerText = allBooks.length;
    renderBooks(allBooks);
  }catch(e){
    console.error("Failed to load books", e);
  }
}
function renderBooks(list){
  const rows = list.map(b => `
    <tr>
      <td>${escapeHtml(b.id)}</td>
      <td>${escapeHtml(b.title)}</td>
      <td>${escapeHtml(b.author)}</td>
      <td>${escapeHtml(b.status)}</td>
      <td>
        <button class="btn-primary edit-book" data-id="${b.id}">Edit</button>
        <button class="btn-primary delete-book" data-id="${b.id}">Delete</button>
      </td>
    </tr>
  `).join("");
  renderTable("libraryList", ["ID","Title","Author","Status","Actions"], rows);

  qsa("#libraryList .edit-book").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const b = allBooks.find(x => Number(x.id) === id);
      openBookForm(b);
    });
  });
  qsa("#libraryList .delete-book").forEach(btn=>{
    btn.addEventListener('click', () => deleteBook(Number(btn.dataset.id)));
  });
}
function filterBooks(){
  const q = (qs("#searchBooks").value || "").toLowerCase();
  const filtered = allBooks.filter(b =>
    (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q) || (b.status || "").toLowerCase().includes(q)
  );
  renderBooks(filtered);
}
function openBookForm(b=null){
  openModal(b? "Edit Book" : "Add Book", `
    <form id="bookForm">
      <input type="hidden" id="book_id" value="${b? escapeHtml(b.id) : ""}">
      <label>Title</label>
      <input type="text" id="book_title" value="${b? escapeHtml(b.title) : ""}" required>
      <label>Author</label>
      <input type="text" id="book_author" value="${b? escapeHtml(b.author) : ""}" required>
      <label>Status</label>
      <select id="book_status">
        <option value="available" ${b && b.status==="available"?"selected":""}>Available</option>
        <option value="issued" ${b && b.status==="issued"?"selected":""}>Issued</option>
      </select>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
  const form = qs("#bookForm");
  if(form) form.addEventListener("submit", saveBook);
}
async function saveBook(e){
  e.preventDefault();
  const id = qs("#book_id").value.trim();
  const payload = {
    id,
    title: qs("#book_title").value.trim(),
    author: qs("#book_author").value.trim(),
    status: qs("#book_status").value
  };
  const action = id ? "update_book" : "add_book";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadBooks();
    loadStats();
  }catch(err){
    console.error("Failed saving book", err);
  }
}
async function deleteBook(id){
  if(!confirm("Delete this book?")) return;
  try{
    await fetch(`api.php?action=delete_book&id=${id}`);
    loadBooks();
    loadStats();
  }catch(e){
    console.error("Failed to delete book", e);
  }
}

/* ============== FEES ============== */
async function loadFees(){
  try{
    const res = await fetch("api.php?action=get_fees");
    allFees = await res.json();
    renderFees(allFees);
  }catch(e){
    console.error("Failed to load fees", e);
  }
}
function renderFees(list){
  const rows = list.map(f => `
    <tr>
      <td>${escapeHtml(f.id)}</td>
      <td>${escapeHtml(f.student_id)}</td>
      <td>${escapeHtml(f.month)}</td>
      <td>${escapeHtml(f.amount)}</td>
      <td>${escapeHtml(f.status)}</td>
      <td>
        <button class="btn-primary edit-fee" data-id="${f.id}">Edit</button>
        <button class="btn-primary delete-fee" data-id="${f.id}">Delete</button>
      </td>
    </tr>
  `).join("");
  renderTable("feesList", ["ID","Student ID","Month","Amount","Status","Actions"], rows);

  qsa("#feesList .edit-fee").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const rec = allFees.find(x => Number(x.id) === id);
      openFeeForm(rec);
    });
  });
  qsa("#feesList .delete-fee").forEach(btn=>{
    btn.addEventListener('click', () => deleteFee(Number(btn.dataset.id)));
  });
}
function filterFees(){
  const q = (qs("#searchFees").value || "").toLowerCase();
  const filtered = allFees.filter(f =>
    String(f.student_id).includes(q) || (f.month||"").toLowerCase().includes(q) ||
    String(f.amount).includes(q) || (f.status||"").toLowerCase().includes(q)
  );
  renderFees(filtered);
}
function openFeeForm(f=null){
  openModal(f? "Edit Fee" : "Add Fee", `
    <form id="feeForm">
      <input type="hidden" id="fee_id" value="${f? escapeHtml(f.id) : ""}">
      <label>Student ID</label>
      <input type="number" id="fee_student_id" value="${f? escapeHtml(f.student_id) : ""}" required>
      <label>Month</label>
      <input type="month" id="fee_month" value="${f? escapeHtml(f.month) : ""}" required>
      <label>Amount</label>
      <input type="number" id="fee_amount" value="${f? escapeHtml(f.amount) : ""}" required>
      <label>Status</label>
      <select id="fee_status">
        <option value="paid" ${f && f.status==="paid"?"selected":""}>Paid</option>
        <option value="unpaid" ${f && f.status==="unpaid"?"selected":""}>Unpaid</option>
      </select>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
  const form = qs("#feeForm");
  if(form) form.addEventListener("submit", saveFee);
}
async function saveFee(e){
  e.preventDefault();
  const id = qs("#fee_id").value.trim();
  const payload = {
    id,
    student_id: Number(qs("#fee_student_id").value),
    month: qs("#fee_month").value,
    amount: Number(qs("#fee_amount").value),
    status: qs("#fee_status").value
  };
  const action = id ? "update_fee_record" : "add_fee_record";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadFees();
    loadStats();
    loadUnpaidStudents();
  }catch(err){
    console.error("Failed saving fee record", err);
  }
}
async function deleteFee(id){
  if(!confirm("Delete this fee record?")) return;
  try{
    await fetch(`api.php?action=delete_fee&id=${id}`);
    loadFees();
    loadStats();
    loadUnpaidStudents();
  }catch(e){
    console.error("Failed to delete fee record", e);
  }
}

/* ============== RESULTS ============== */
async function loadResults(){
  try{
    const res = await fetch("api.php?action=get_results");
    allResults = await res.json();
    renderResults(allResults);
  }catch(e){
    console.error("Failed to load results", e);
  }
}
function renderResults(list){
  const rows = list.map(r => `
    <tr>
      <td>${escapeHtml(r.id)}</td>
      <td>${escapeHtml(r.student_id)}</td>
      <td>${escapeHtml(r.subject)}</td>
      <td>${escapeHtml(r.marks)}</td>
      <td>${escapeHtml(r.grade)}</td>
      <td>
        <button class="btn-primary edit-result" data-id="${r.id}">Edit</button>
        <button class="btn-primary delete-result" data-id="${r.id}">Delete</button>
      </td>
    </tr>
  `).join("");
  renderTable("resultsList", ["ID","Student ID","Subject","Marks","Grade","Actions"], rows);

  qsa("#resultsList .edit-result").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const rec = allResults.find(x => Number(x.id) === id);
      openResultForm(rec);
    });
  });
  qsa("#resultsList .delete-result").forEach(btn=>{
    btn.addEventListener('click', () => deleteResult(Number(btn.dataset.id)));
  });
}
function filterResults(){
  const q = (qs("#searchResults").value || "").toLowerCase();
  const filtered = allResults.filter(r =>
    String(r.student_id).includes(q) || (r.subject||"").toLowerCase().includes(q) ||
    String(r.marks).includes(q) || (r.grade||"").toLowerCase().includes(q)
  );
  renderResults(filtered);
}
function openResultForm(r=null){
  openModal(r? "Edit Result" : "Add Result", `
    <form id="resultForm">
      <input type="hidden" id="res_id" value="${r? escapeHtml(r.id) : ""}">
      <label>Student ID</label>
      <input type="number" id="res_student_id" value="${r? escapeHtml(r.student_id) : ""}" required>
      <label>Subject</label>
      <input type="text" id="res_subject" value="${r? escapeHtml(r.subject) : ""}" required>
      <label>Marks</label>
      <input type="number" id="res_marks" value="${r? escapeHtml(r.marks) : ""}" required>
      <label>Grade</label>
      <input type="text" id="res_grade" value="${r? escapeHtml(r.grade) : ""}" required>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
  const form = qs("#resultForm");
  if(form) form.addEventListener("submit", saveResult);
}
async function saveResult(e){
  e.preventDefault();
  const id = qs("#res_id").value.trim();
  const payload = {
    id,
    student_id: Number(qs("#res_student_id").value),
    subject: qs("#res_subject").value.trim(),
    marks: Number(qs("#res_marks").value),
    grade: qs("#res_grade").value.trim()
  };
  const action = id ? "update_result" : "add_result";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadResults();
  }catch(err){
    console.error("Failed saving result", err);
  }
}
async function deleteResult(id){
  if(!confirm("Delete this result?")) return;
  try{
    await fetch(`api.php?action=delete_result&id=${id}`);
    loadResults();
  }catch(e){
    console.error("Failed to delete result", e);
  }
}

/* ============== TIMETABLE ============== */
async function loadTimetable(){
  try{
    const res = await fetch("api.php?action=get_timetable");
    allTimetable = await res.json();
    renderTimetable(allTimetable);
  }catch(e){
    console.error("Failed to load timetable", e);
  }
}
function renderTimetable(list){
  const rows = list.map(t => `
    <tr>
      <td>${escapeHtml(t.id)}</td>
      <td>${escapeHtml(t.class)}</td>
      <td>${escapeHtml(t.subject)}</td>
      <td>${escapeHtml(t.day)}</td>
      <td>${escapeHtml(t.time)}</td>
      <td>${escapeHtml(t.teacher_id)}</td>
      <td>
        <button class="btn-primary edit-tt" data-id="${t.id}">Edit</button>
        <button class="btn-primary delete-tt" data-id="${t.id}">Delete</button>
      </td>
    </tr>
  `).join("");
  renderTable("timetableList",
    ["ID","Class","Subject","Day","Time","Teacher ID","Actions"], rows);

  qsa("#timetableList .edit-tt").forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const id = Number(btn.dataset.id);
      const rec = allTimetable.find(x => Number(x.id) === id);
      openTimetableForm(rec);
    });
  });
  qsa("#timetableList .delete-tt").forEach(btn=>{
    btn.addEventListener('click', () => deleteTimetable(Number(btn.dataset.id)));
  });
}
function filterTimetable(){
  const q = (qs("#searchTimetable").value || "").toLowerCase();
  const filtered = allTimetable.filter(t =>
    (t.class||"").toLowerCase().includes(q) ||
    (t.subject||"").toLowerCase().includes(q) ||
    (t.day||"").toLowerCase().includes(q) ||
    (t.time||"").toLowerCase().includes(q) ||
    String(t.teacher_id).includes(q)
  );
  renderTimetable(filtered);
}
function openTimetableForm(t=null){
  openModal(t? "Edit Schedule" : "Add Schedule", `
    <form id="ttForm">
      <input type="hidden" id="tt_id" value="${t? escapeHtml(t.id) : ""}">
      <label>Class</label>
      <input type="text" id="tt_class" value="${t? escapeHtml(t.class) : ""}" required>
      <label>Subject</label>
      <input type="text" id="tt_subject" value="${t? escapeHtml(t.subject) : ""}" required>
      <label>Day</label>
      <input type="text" id="tt_day" value="${t? escapeHtml(t.day) : ""}" required>
      <label>Time</label>
      <input type="text" id="tt_time" value="${t? escapeHtml(t.time) : ""}" required>
      <label>Teacher ID</label>
      <input type="number" id="tt_teacher" value="${t? escapeHtml(t.teacher_id) : ""}" required>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-primary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>
  `);
  const form = qs("#ttForm");
  if(form) form.addEventListener("submit", saveTimetable);
}
async function saveTimetable(e){
  e.preventDefault();
  const id = qs("#tt_id").value.trim();
  const payload = {
    id,
    class: qs("#tt_class").value.trim(),
    subject: qs("#tt_subject").value.trim(),
    day: qs("#tt_day").value.trim(),
    time: qs("#tt_time").value.trim(),
    teacher_id: Number(qs("#tt_teacher").value)
  };
  const action = id ? "update_timetable" : "add_timetable";
  try{
    await fetch(`api.php?action=${action}`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    closeModal();
    loadTimetable();
  }catch(err){
    console.error("Failed saving timetable", err);
  }
}
async function deleteTimetable(id){
  if(!confirm("Delete this schedule?")) return;
  try{
    await fetch(`api.php?action=delete_timetable&id=${id}`);
    loadTimetable();
  }catch(e){
    console.error("Failed to delete timetable", e);
  }
}
function exportFeesReport() {
  const month = document.getElementById("reportMonth").value || new Date().toISOString().slice(0,7);
  window.open(`api.php?action=export_fees_report&month=${month}`, "_blank");
}

/* ============== INIT ============== */
function init(){
  // default first view
  showSection('dashboard');
  // load everything
  loadStats();
  loadStudents();
  loadTeachers();
  loadBooks();
  loadFees();
  loadResults();
  loadTimetable();
}
document.addEventListener("DOMContentLoaded", init);
async function loadStats() {
  const res = await fetch("api.php?action=get_stats");
  const data = await res.json();
  document.getElementById("statStudents").textContent = data.students;
  document.getElementById("statTeachers").textContent = data.teachers;
  document.getElementById("statBooks").textContent = data.books;
  document.getElementById("statUnpaid").textContent = data.unpaid_fees;

  loadUnpaidStudents(); // 👈 also fetch unpaid list
}

