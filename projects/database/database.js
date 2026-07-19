function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function dbOpenDiagram(src, label) {
  const lightbox = document.getElementById('db-lightbox');
  document.getElementById('db-lightbox-img').src = src;
  document.getElementById('db-lightbox-label').textContent = label;
  lightbox.removeAttribute('hidden');
}

function dbCloseDiagram() {
  document.getElementById('db-lightbox').setAttribute('hidden', '');
}

bindEscapeToClose(() => !document.getElementById('db-lightbox')?.hidden, dbCloseDiagram);

// Every query button shares this exact shape: hit one action on the same
// API, show the result via its own display function, or fall back to
// showError(). Factored out so each fetchX below is just its action name
// and its display call, not another copy of the same try/catch.
async function dbFetchAndDisplay(action, onSuccess) {
    try {
        const response = await fetch(`projects/database/api.php?action=${action}`);
        const result = await response.json();

        if (result.status === 'success') {
            onSuccess(result.data);
        } else {
            showError(result.message);
        }
    } catch (error) {
        showError(error.message);
    }
}

function fetchInterviewers() {
    return dbFetchAndDisplay('interviewers', displayInterviewers);
}

function fetchSalesJobsJan2011() {
    return dbFetchAndDisplay('sales_jobs_jan_2011', (data) => displayJobsList(data, 'Sales Jobs Posted in January 2011'));
}

function fetchEmployeesNoSupervisees() {
    return dbFetchAndDisplay('employees_no_supervisees', (data) => displayEmployeesList(data, 'Employees with No Supervisees'));
}

function fetchSitesNoSalesMarch2011() {
    return dbFetchAndDisplay('sites_no_sales_march_2011', (data) => displaySitesList(data, 'Marketing Sites with No Sales in March 2011'));
}

function fetchUnfilledJobs() {
    return dbFetchAndDisplay('unfilled_jobs', (data) => displayJobsList(data, 'Jobs Unfilled After One Month'));
}

function fetchTopSalesmen() {
    return dbFetchAndDisplay('top_salesmen', (data) => displaySalesmenList(data, 'Top Salesmen (Sold All Premium Products)'));
}

function fetchInactiveDepartments() {
    return dbFetchAndDisplay('inactive_departments', (data) => displayDepartmentsList(data, 'Departments with No Job Posts in January 2011'));
}

function fetchInternalApplicants() {
    return dbFetchAndDisplay('internal_applicants', (data) => displayEmployeesListTwo(data, 'Internal Applicants for Job #12345'));
}

function fetchBestSellingType() {
    return dbFetchAndDisplay('best_selling_type', (data) => displaySingleItem(data, 'Best Selling Product Type'));
}

function fetchHighestProfitType() {
    return dbFetchAndDisplay('highest_profit_type', (data) => displayProfitInfo(data, 'Highest Profit Product Type'));
}

function fetchAllDeptEmployees() {
    return dbFetchAndDisplay('all_dept_employees', (data) => displayEmployeesList(data, 'Employees Who Worked in All Departments'));
}

function fetchSelectedInterviewees() {
    return dbFetchAndDisplay('selected_interviewees', (data) => displayIntervieweesList(data, 'Selected Candidates'));
}

function fetchSelectedForAll() {
    return dbFetchAndDisplay('selected_for_all', (data) => displayEmployeesListThree(data, 'Selected All Applications'));
}

function fetchHighestSalaryEmployee() {
    return dbFetchAndDisplay('highest_salary_employee', (data) => displaySalaryInfo(data, 'Highest Paid Employee'));
}

function fetchCheapestCupVendor() {
    return dbFetchAndDisplay('cheapest_cup_vendor', (data) => displayVendorInfo(data, 'Cheapest Cup Vendor (Under 4 lbs)'));
}

function cancelDatabaseForm() {
    const resultsDiv = document.getElementById('database-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }
}

function refreshAndClearDatabaseResults() {
    if (typeof showCustomers === 'function') {
        setTimeout(() => showCustomers(), 1500);
    }
    setTimeout(() => {
        document.getElementById('database-results').innerHTML = '';
    }, 2000);
}

async function insertCustomer() {
    try {
        const resultsDiv = document.getElementById('database-results');
        resultsDiv.innerHTML = '';

        const formDiv = document.createElement('div');
        formDiv.innerHTML = `
            <div class="database-info">
                <h3>Insert New Customer</h3>
                <form id="customerForm" class="terminal-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="f_name">First Name*</label>
                            <input type="text" id="f_name" name="f_name" required>
                        </div>
                        <div class="form-group">
                            <label for="m_init">Middle Initial</label>
                            <input type="text" id="m_init" name="m_init" maxlength="1">
                        </div>
                        <div class="form-group">
                            <label for="l_name">Last Name*</label>
                            <input type="text" id="l_name" name="l_name" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="sex">Sex*</label>
                            <select id="sex" name="sex" required>
                                <option value="">Select</option>
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="b_day">Birthday*</label>
                            <input type="date" id="b_day" name="b_day" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="p_num">Phone Number*</label>
                            <input type="tel" id="p_num" name="p_num" placeholder="555-666-7777" pattern="\\d{3}-\\d{3}-\\d{4}" required>
                        </div>
                        <div class="form-group">
                            <label for="customer_email">Email*</label>
                            <input type="email" id="customer_email" name="customer_email" required>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label for="street">Street Address*</label>
                        <input type="text" id="street" name="street" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="apt_no">Apt/Unit #</label>
                            <input type="text" id="apt_no" name="apt_no">
                        </div>
                        <div class="form-group">
                            <label for="city">City*</label>
                            <input type="text" id="city" name="city" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="state">State*</label>
                            <input type="text" id="state" name="state" maxlength="50" required>
                        </div>
                        <div class="form-group">
                            <label for="zip">ZIP Code*</label>
                            <input type="text" id="zip" name="zip" pattern="\\d{5}" maxlength="5" required>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label for="sales_rep_id">Sales Representative ID (optional)</label>
                        <input type="number" id="sales_rep_id" name="sales_rep_id">
                    </div>

                    <div class="button-group">
                        <button type="button" onclick="cancelDatabaseForm()" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Customer</button>
                    </div>
                </form>
                <div id="form-message" class="form-message"></div>
            </div>
        `;
        
        resultsDiv.appendChild(formDiv);
        
        const form = document.getElementById('customerForm');
        form.addEventListener('submit', handleCustomerSubmit);
        
    } catch (error) {
        console.error('Error:', error);
        if (typeof showError === 'function') {
            showError('Error initializing customer form: ' + error.message);
        } else {
            const resultsDiv = document.getElementById('database-results');
            if (resultsDiv) {
                resultsDiv.innerHTML = `<div class="error">Error initializing customer form: ${error.message}</div>`;
            }
        }
    }
}

async function showCustomers() {
    try {
        const resultsDiv = document.getElementById('database-results');
        resultsDiv.innerHTML = '<p>Loading fresh data...</p>';

        window.customerData = null;
        
        const timestamp = new Date().getTime();
        const response = await fetch(`projects/database/api.php?action=show_customers&_t=${timestamp}`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            displayCustomersList(result.data, 'Customer Info');
        } else {
            showError(result.message);
        }
    } catch (error) {
        showError(error.message);
    }
}

function displayJobsList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No jobs found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Job ID</th><th>Title</th><th>Description</th><th>Date Posted</th></tr></thead><tbody>';
        data.forEach(job => {
            html += `<tr><td>${escapeHtml(job.job_id)}</td><td>${escapeHtml(job.job_title || 'N/A')}</td><td>${escapeHtml(job.job_disc || 'N/A')}</td><td>${escapeHtml(job.date_posted || 'N/A')}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayEmployeesList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No employees found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Title/Department</th></tr></thead><tbody>';
        data.forEach(emp => {
            html += `<tr><td>${escapeHtml(emp.employee_id)}</td><td>${escapeHtml(emp.employee_name)}</td><td>${escapeHtml(emp.title || emp.current_dep || emp.all_dep || 'N/A')}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayEmployeesListThree(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No employees found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Name</th><th>Phone Number</th><th>Email</th></tr></thead><tbody>';
        data.forEach(empthree => {
            html += `<tr><td>${escapeHtml(empthree.f_name)} ${escapeHtml(empthree.l_name)}</td><td>${escapeHtml(empthree.phone_number)}</td><td>${escapeHtml(empthree.email)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayEmployeesListTwo(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No employees found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Title/Department</th><th>Job ID</th></tr></thead><tbody>';
        data.forEach(empt => {
            html += `<tr><td>${escapeHtml(empt.employee_id)}</td><td>${escapeHtml(empt.employee_name)}</td><td>${escapeHtml(empt.current_dep)}</td><td>${escapeHtml(empt.job_id)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displaySitesList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No sites found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Site ID</th><th>Site Name</th><th>Location</th></tr></thead><tbody>';
        data.forEach(site => {
            html += `<tr><td>${escapeHtml(site.site_id)}</td><td>${escapeHtml(site.site_name || 'N/A')}</td><td>${escapeHtml(site.site_location)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displaySalesmenList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No salesmen found matching criteria.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Employee ID</th><th>Name</th></tr></thead><tbody>';
        data.forEach(salesman => {
            html += `<tr><td>${escapeHtml(salesman.employee_id)}</td><td>${escapeHtml(salesman.salesman_name)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayDepartmentsList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>All departments posted jobs in January 2011.</p>';
    } else {
        html += '<ul>';
        data.forEach(dept => {
            html += `<li>${escapeHtml(dept.department)}</li>`;
        });
        html += '</ul>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displaySingleItem(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    html += '<div class="info-grid">';
    html += `<div class="info-item"><h4>Product Type</h4><p>${escapeHtml(data.product_type)}</p></div>`;
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayProfitInfo(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    html += '<div class="info-grid">';
    html += `<div class="info-item"><h4>Product Type</h4><p>${escapeHtml(data.product_type)}</p></div>`;
    html += `<div class="info-item"><h4>Net Profit</h4><p>$${parseFloat(data.net_profit).toFixed(2)}</p></div>`;
    html += '</div></div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayIntervieweesList(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No selected candidates found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>ID</th><th>Name</th><th>Email</th></tr></thead><tbody>';
        data.forEach(person => {
            html += `<tr><td>${escapeHtml(person.person_id)}</td><td>${escapeHtml(person.f_name)} ${escapeHtml(person.l_name)}</td><td>${escapeHtml(person.email)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displaySalaryInfo(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (data.length === 0) {
        html += '<p>No employees found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Average Monthly Salary</th></tr></thead><tbody>';
        data.forEach(empsal => {
            html += `<tr><td>${escapeHtml(empsal.employee_id)}</td><td>${escapeHtml(empsal.employee_name)}</td><td>$${parseFloat(empsal.avg_monthly_salary).toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayVendorInfo(data, title) {
    let html = `<div class="database-info"><h3>${title}</h3>`;
    
    if (!data) {
        html += '<p>No vendor found matching criteria.</p>';
    } 
    else {
        html += '<table class="database-table"><thead><tr><th>Vendor ID</th><th>Vendor Name</th><th>Part Price</th><th>Weight</th></tr></thead><tbody>';
        data.forEach(ven => {
            html += `<tr><td>${escapeHtml(ven.vendor_id || 'N/A')}</td><td>${escapeHtml(ven.vendor_name || 'N/A')}</td><td>$${ven.part_price ? parseFloat(ven.part_price).toFixed(2) : 'N/A'}</td><td>${ven.weight ? escapeHtml(ven.weight) + ' lbs' : 'N/A'}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function showError(message) {
    document.getElementById('database-results').innerHTML =
        `<p class="error">Error: ${message}</p>`;
}


function displayCustomersList(data, title) {
    const timestamp = new Date().toLocaleString();
    let html = `<div class="database-info">
                <h3>${title}</h3>
                <p>Last updated: ${timestamp}</p>`;
    
    if (!data || data.length === 0) {
        html += '<p>No customers found.</p>';
    } else {
        html += `<p>Showing ${data.length} customers</p>`;
        html += '<table class="database-table"><thead><tr><th>Customer Name</th><th>Email</th><th>Phone Number</th><th>Location</th></tr></thead><tbody>';
        data.forEach(customer => {
            html += `<tr>
                        <td>${escapeHtml(customer.f_name)} ${customer.m_init ? escapeHtml(customer.m_init) + '.' : ''} ${escapeHtml(customer.l_name)}</td>
                        <td>${escapeHtml(customer.customer_email)}</td>
                        <td>${escapeHtml(customer.phone_number)}</td>
                        <td>${escapeHtml(customer.city)}, ${escapeHtml(customer.state)}</td>
                    </tr>`;
        });
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}

function displayInterviewers(data) {
    let html = `
        <div class="database-info">
            <h3>Interviewers for Hellen Cole (Job #11111)</h3>
    `;
    
    if (data.length === 0) {
        html += '<p>No interviewers found.</p>';
    } else {
        html += '<table class="database-table"><thead><tr><th>Interviewer ID</th><th>Interviewer Name</th></tr></thead><tbody>';
        
        data.forEach(interviewer => {
            html += `<tr><td>${escapeHtml(interviewer.interviewer_id)}</td><td>${escapeHtml(interviewer.interviewer_name)}</td></tr>`;
        });
        
        html += '</tbody></table>';
    }
    
    html += '</div>';
    document.getElementById('database-results').innerHTML = html;
}