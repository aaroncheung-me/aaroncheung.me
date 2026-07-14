function initTerminalForm() {
  const terminalOutput = document.getElementById('terminal-output');
  if (!terminalOutput) {
    return;
  }

  terminalOutput.innerHTML = '';

  const fields = [
    { name: 'name', prompt: 'name:', hint: 'type name => Enter ↵' },
    { name: 'email', prompt: 'email:', hint: 'type email => Enter ↵' },
    { name: 'subject', prompt: 'subject:', hint: 'type subject => Enter ↵' },
    { name: 'message', prompt: 'message:', hint: 'type message => Enter ↵' }
  ];

  const firstPromptLine = document.createElement('div');
  firstPromptLine.classList.add('prompt-line');
  firstPromptLine.innerHTML = `
    <span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span>
    <span class="command">name: </span>
    <input type="text" class="terminal-input" id="name-input" placeholder="${fields[0].hint}">
  `;

  terminalOutput.appendChild(firstPromptLine);

  let currentInput = document.getElementById('name-input');
  if (!currentInput) {
    return;
  }

  let currentFieldIndex = 0;
  const formData = {
    access_key: "f4a434e2-ab3d-443c-be6e-e16e9521ee28",
    from_name: "Aaron's Portfolio Contact Form"
  };

  function handleInputSubmission(event) {
    if (event.key === 'Enter') {
      event.preventDefault();

      const value = this.value.trim();
      if (value) {
        formData[fields[currentFieldIndex].name] = value;

        const currentLine = this.parentElement;
        currentLine.innerHTML = `<span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span> <span class="command">${fields[currentFieldIndex].prompt}</span> <span class="user-input">${value}</span>`;
        currentLine.classList.remove('prompt-line');
        currentLine.classList.add('previous-line');

        currentFieldIndex++;

        if (currentFieldIndex < fields.length) {
          const newLine = document.createElement('div');
          newLine.classList.add('prompt-line');
          newLine.innerHTML = `
            <span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span>
            <span class="command">${fields[currentFieldIndex].prompt}</span>
            <input type="text" class="terminal-input" id="${fields[currentFieldIndex].name}-input" placeholder="${fields[currentFieldIndex].hint}">
          `;

          terminalOutput.appendChild(newLine);

          currentInput = document.getElementById(`${fields[currentFieldIndex].name}-input`);
          if (currentInput) {
            currentInput.addEventListener('keydown', handleInputSubmission);
            currentInput.focus();
          }
        } else {
          submitFormToWeb3Forms();
        }
      }
    }
  }

  function submitFormToWeb3Forms() {
    const submissionLine = document.createElement('div');
    submissionLine.classList.add('previous-line');
    submissionLine.innerHTML = `<span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span> <span class="command">Submitting form...</span>`;
    terminalOutput.appendChild(submissionLine);

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
      const line = document.createElement('div');
      line.classList.add('previous-line');
      if (data.success) {
        line.innerHTML = `<span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span> <span class="command">Thank you! Your message has been sent.</span>`;
      } else {
        line.innerHTML = `<span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span> <span class="command">Error: ${data.message || 'Could not send message'}</span>`;
      }
      terminalOutput.appendChild(line);
    })
    .catch(() => {
      const errorLine = document.createElement('div');
      errorLine.classList.add('previous-line');
      errorLine.innerHTML = `<span class="prompt"><span class=\"text-orange\">>aaron@portfolio</span>:<span class=\"text-blue\">~contact form</span>$</span> <span class="command">Error: Could not connect to server. Please try again later.</span>`;
      terminalOutput.appendChild(errorLine);
    });
  }

  currentInput.addEventListener('keydown', handleInputSubmission);
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('terminal-container')) {
    initTerminalForm();
  }
});
