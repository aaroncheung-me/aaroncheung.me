async function deleteCustomer() {
    try {
        const resultsDiv = document.getElementById('database-results');
        resultsDiv.innerHTML = '';

        const customersResponse = await fetch('php/api.php?action=get_customers');
        const customersData = await customersResponse.json();

        if (customersData.status !== 'success') {
            throw new Error('Failed to fetch customers');
        }

        const formDiv = document.createElement('div');
        formDiv.innerHTML = `
            <div class="database-info">
                <h3>Delete Customer</h3>
                <form id="deleteCustomerForm" class="terminal-form">
                    <div class="form-group full-width">
                        <label for="customer_select">Select Customer to Delete*</label>
                        <select id="customer_select" name="person_id" required>
                            <option value="">-- Select a Customer --</option>
                            ${customersData.customers.map(customer =>
                                `<option value="${customer.person_id}">
                                    ${customer.f_name} ${customer.l_name} - ${customer.customer_email}
                                </option>`
                            ).join('')}
                        </select>
                    </div>

                    <div id="customer-details" class="customer-info" style="display: none;">
                        <h4>Customer Details:</h4>
                        <p id="customer-info-text"></p>
                    </div>

                    <div class="button-group">
                        <button type="button" onclick="cancelDatabaseForm()" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-danger">Delete Customer</button>
                    </div>
                </form>
                <div id="delete-message" class="form-message"></div>
            </div>
        `;

        resultsDiv.appendChild(formDiv);

        const form = document.getElementById('deleteCustomerForm');
        form.addEventListener('submit', handleDeleteSubmit);

        const select = document.getElementById('customer_select');
        select.addEventListener('change', showCustomerDetails);

    } catch (error) {
        console.error('Error:', error);
        const resultsDiv = document.getElementById('database-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">Error initializing delete form: ${error.message}</div>`;
        }
    }
}

function showCustomerDetails(e) {
    const select = e.target;
    const detailsDiv = document.getElementById('customer-details');
    const infoText = document.getElementById('customer-info-text');

    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        detailsDiv.style.display = 'block';
        infoText.textContent = selectedOption.textContent;
    } else {
        detailsDiv.style.display = 'none';
    }
}

async function handleDeleteSubmit(e) {
    e.preventDefault();

    const select = document.getElementById('customer_select');
    const personId = select.value;

    if (!personId) {
        alert('Please select a customer to delete');
        return;
    }

    const selectedOption = select.options[select.selectedIndex].textContent;
    if (!confirm(`Are you sure you want to delete customer: ${selectedOption}?`)) {
        return;
    }

    const messageDiv = document.getElementById('delete-message');
    messageDiv.innerHTML = '<span class="loading">Deleting customer...</span>';
    messageDiv.className = 'form-message show';

    try {
        const dataToSend = { person_id: parseInt(personId, 10) };
        const response = await fetch('php/api.php?action=delete_customer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        });

        const result = await response.json();

        if (result.status === 'success') {
            messageDiv.innerHTML = '<span class="success">Success: ' + result.message + '</span>';
            messageDiv.className = 'form-message show success';

            e.target.reset();
            document.getElementById('customer-details').style.display = 'none';

            refreshAndClearDatabaseResults();
        } else {
            messageDiv.innerHTML = '<span class="error">Error: ' + result.message + '</span>';
            messageDiv.className = 'form-message show error';
        }
    } catch (error) {
        console.error('Error:', error);
        messageDiv.innerHTML = '<span class="error">Network Error: Could not connect to database.</span>';
        messageDiv.className = 'form-message show error';
    }
}

if (!document.getElementById('deleteFormStyles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'deleteFormStyles';
    styleSheet.textContent = `
        .btn-danger {
            color: #ff6b6b;
            border-color: #ff6b6b;
        }

        .btn-danger:hover {
            background: rgba(255, 107, 107, 0.1);
        }

        .customer-info {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid var(--clr-primary-txt);
            background: rgba(255, 255, 255, 0.02);
        }

        .customer-info h4 {
            margin: 0 0 10px 0;
            color: var(--clr-blue);
        }

        .customer-info p {
            margin: 0;
            color: var(--clr-primary-txt);
        }
    `;
    document.head.appendChild(styleSheet);
}

window.deleteCustomer = deleteCustomer;
window.showCustomerDetails = showCustomerDetails;
