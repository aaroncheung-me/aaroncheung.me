async function handleCustomerSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const customerData = {};
    
    for (let [key, value] of formData.entries()) {
        customerData[key] = value || null;
    }

    const messageDiv = document.getElementById('form-message');
    messageDiv.innerHTML = '<span class="loading">Inserting customer into database...</span>';
    messageDiv.className = 'form-message show';
    
    try {
        const response = await fetch('projects/database/api.php?action=insert_customer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            messageDiv.innerHTML = '<span class="success">Success: ' + result.message + '</span>';
            messageDiv.className = 'form-message show success';
            
            e.target.reset();

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

if (!document.getElementById('customerFormStyles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'customerFormStyles';
    styleSheet.textContent = `
        .terminal-form {
            font-family: 'Fira Mono', monospace;
            color: var(--clr-primary-txt);
            margin-top: 20px;
        }
        
        .form-row {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .form-group {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .form-group.full-width {
            width: 100%;
            margin-bottom: 15px;
        }
        
        .form-group label {
            margin-bottom: 5px;
            font-size: 0.9rem;
            color: var(--clr-blue);
        }
        
        .form-group input,
        .form-group select {
            padding: 8px;
            background-color: transparent;
            border: 1px solid var(--clr-primary-txt);
            color: var(--clr-primary-txt);
            font-family: 'Fira Mono', monospace;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            border-color: var(--clr-light-blue);
        }
        
        .form-group input::placeholder {
            color: rgba(201, 209, 217, 0.5);
        }
        
        .button-group {
            margin-top: 25px;
            display: flex;
            gap: 15px;
            justify-content: flex-end;
        }
        
        .btn {
            padding: 10px 20px;
            border: 1px solid currentColor;
            background: transparent;
            color: currentColor;
            cursor: pointer;
            font-family: 'Fira Mono', monospace;
            font-size: 0.9rem;
            transition: background-color 0.2s;
        }
        
        .btn-primary {
            color: var(--clr-light-blue);
            border-color: var(--clr-light-blue);
        }
        
        .btn-primary:hover {
            background: rgba(88, 166, 255, 0.1);
        }
        
        .btn-secondary {
            color: var(--clr-primary-txt);
            border-color: var(--clr-primary-txt);
        }
        
        .btn-secondary:hover {
            background: rgba(201, 209, 217, 0.1);
        }
        
        .form-message {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid transparent;
            font-size: 0.9rem;
            text-align: center;
            display: none;
        }
        
        .form-message.show {
            display: block;
        }
        
        .form-message.success {
            border-color: var(--clr-light-blue);
            color: var(--clr-light-blue);
        }
        
        .form-message.error {
            border-color: #ff6b6b;
            color: #ff6b6b;
        }
        
        .form-message .loading {
            color: var(--clr-orange);
        }
        
        @media (max-width: 768px) {
            .form-row {
                flex-direction: column;
                gap: 10px;
            }
            
            .form-group {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(styleSheet);
}

window.handleCustomerSubmit = handleCustomerSubmit;