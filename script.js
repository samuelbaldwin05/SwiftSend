/**
 * SwiftSend - Email Campaign Builder
 * Complete functionality in a single, clean JavaScript file
 */

// Global state
let csvData = [];
let columns = [];
let emailDrafts = [];
let currentFilter = 'all';
let lastFocusedInput = 'emailBody'; // Track last focused input, default to message

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupFileUpload();
    setupTemplateEditor();
    setupEmailManagement();
    setupNavigation();
});

// === FILE UPLOAD & PARSING ===
function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.background = '#f0f0f0';
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.background = '';
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.background = '';
            if (e.dataTransfer.files[0]) {
                processFile(e.dataTransfer.files[0]);
            }
        });
    }
}

function handleFileSelect(e) {
    if (e.target.files[0]) {
        processFile(e.target.files[0]);
    }
}

function processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const fileType = document.getElementById('fileTypeSelect')?.value || 'normal';
    
    if (extension === 'csv') {
        parseCSV(file, fileType);
    } else if (['xlsx', 'xls'].includes(extension)) {
        parseExcel(file, fileType);
    } else {
        alert('Please upload a CSV or Excel file');
    }
}

function parseCSV(file, fileType = 'normal') {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => typeof value === 'string' ? value.trim() : value,
        complete: function(results) {
            if (fileType === 'pitchbook') {
                csvData = processPitchBookData(results.data);
            } else {
                csvData = results.data;
            }
            columns = Object.keys(csvData[0] || {});
            showDataPreview();
            updateFieldsList();
        },
        error: function(error) {
            alert('Error parsing CSV: ' + error.message);
        }
    });
}

function parseExcel(file, fileType = 'normal') {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            let cleanedData = jsonData.map(row => {
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    cleanRow[key] = typeof value === 'string' ? value.trim() : value;
                }); 
                return cleanRow;
            });
            
            if (fileType === 'pitchbook') {
                csvData = processPitchBookData(cleanedData);
            } else {
                csvData = cleanedData;
            }
            
            columns = Object.keys(csvData[0] || {});
            showDataPreview();
            updateFieldsList();
        } catch (error) {
            alert('Error parsing Excel file: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// === PITCHBOOK DATA PROCESSING ===
function processPitchBookData(rawData) {
    console.log('Processing PitchBook data...');
    
    // Row 3 (index 3) has the headers, Row 4+ (index 4+) has the data
    if (rawData.length < 5) {
        console.log('Not enough rows for PitchBook data');
        return [];
    }
    
    const headerRow = rawData[3];
    console.log('Header row:', headerRow);
    
    // Create mapping from header values to column keys
    const columnMapping = {};
    Object.keys(headerRow).forEach(key => {
        const headerValue = headerRow[key];
        if (headerValue && typeof headerValue === 'string') {
            columnMapping[headerValue] = key;
        }
    });
    
    console.log('Column mapping:', columnMapping);
    
    const processedData = [];
    
    // Process data rows starting from row 4 (index 4)
    for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Skip copyright rows
        if (row.SS && String(row.SS).includes('© PitchBook')) {
            continue;
        }
        
        // Extract data using the column mapping
        const companyName = row[columnMapping['Companies']];
        
        if (!companyName) continue;
        
        const fullName = row[columnMapping['Primary Contact']] || '';
        
        // Split name into firstname and lastname
        let firstname = '';
        let lastname = '';
        if (fullName && fullName.trim()) {
            const nameParts = fullName.trim().split(' ');
            firstname = nameParts[0] || '';
            lastname = nameParts[nameParts.length - 1] || '';
        }
        
        const processedRow = {
            'company': String(companyName).trim(),
            'name': fullName,
            'firstname': firstname,
            'lastname': lastname,
            'email': row[columnMapping['Primary Contact Email']] || '',
            'title': row[columnMapping['Primary Contact Title']] || '',
            'description': row[columnMapping['Description']] || '',
            'founded': row[columnMapping['Year Founded']] || '', 
            'location': row[columnMapping['HQ Location']] || '',
            'industry': row[columnMapping['Primary Industry Sector']] || '',
            'website': row[columnMapping['Website']] || ''
        };
        
        processedData.push(processedRow);
    }
    
    console.log('Processed companies:', processedData);
    return processedData;
}


function showDataPreview() {
    const preview = document.getElementById('dataPreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const stats = document.getElementById('previewStats');
    const table = document.getElementById('previewTable');
    const clearDiv = document.getElementById('clearDatabase');
    
    // Update stats
    stats.textContent = `${csvData.length} rows, ${columns.length} columns`;
    
    // Add clear button
    // Add clear button with smaller styling
clearDiv.innerHTML = '<span onclick="clearUploadedData()" class="btn" style="padding: 0px; font-size: 14px;">Clear Data</span>';
    
    // Create scrollable table container
    let html = '<div class="preview-table-container">';
    html += '<table class="table"><thead><tr>';
    
    // Show all columns, not just first 4
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Show more rows for better scrolling
    csvData.slice(0, 10).forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const value = String(row[col] || '');
            // Cap at 20 characters with ellipsis
            const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
            html += `<td title="${value}">${displayValue}</td>`;
        });
        html += '</tr>';
    });
    
    if (csvData.length > 10) {
        html += `<tr><td colspan="${columns.length}" style="text-align: center; font-style: italic; color: var(--text-light);">... and ${csvData.length - 10} more rows</td></tr>`;
    }
    
    html += '</tbody></table></div>';
    table.innerHTML = html;
    
    // Show preview, hide placeholder
    preview.classList.remove('hidden');
    placeholder.style.display = 'none';
}


function clearUploadedData() {
    // Clear CSV data and columns
    csvData = [];
    columns = [];
    
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    fileInput.value = '';
    
    // Reset file type selector
    const fileTypeSelect = document.getElementById('fileTypeSelect');
    fileTypeSelect.value = 'normal';
    
    // Hide preview, show placeholder
    const preview = document.getElementById('dataPreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    preview.classList.add('hidden');
    placeholder.style.display = 'block';
    
    // Reset fields list
    updateFieldsList();
    
    // Clear template preview if shown
    const templatePreview = document.getElementById('templatePreview');
    templatePreview.classList.add('hidden');
    
    // Update generate button state (disable since no data)
    const generateBtn = document.getElementById('generateEmails');
    generateBtn.disabled = true;

}

// === TEMPLATE EDITOR ===
function setupTemplateEditor() {
    const emailTo = document.getElementById('emailTo');
    const emailSubject = document.getElementById('emailSubject');
    const emailBody = document.getElementById('emailBody');
    const generateBtn = document.getElementById('generateEmails');
    const previewBtn = document.getElementById('previewTemplate');
    const templatePresets = document.getElementById('templatePresets');
    const clearBtn = document.getElementById('clearTemplate');
    
    // Add focus listeners to track last focused input
    emailTo.addEventListener('focus', () => lastFocusedInput = 'emailTo');
    emailSubject.addEventListener('focus', () => lastFocusedInput = 'emailSubject');
    emailBody.addEventListener('focus', () => lastFocusedInput = 'emailBody');
    
    // Template presets
    const templates = {
        introduction: {
            to: '{{email}}',
            subject: 'Introduction - {{name}}',
            body: 'Dear {{name}},\n\nI hope this email finds you well. I wanted to reach out and introduce myself.\n\nBest regards,\n[Your name]'
        },
        pitchbookV: {
            to: '{{email}}',
            subject: 'UConn Hillside Ventures - {{company}}',
            body: "Hi {{firstname}},\n\nI'm Vitória from the University of Connecticut's venture firm specializing in manufacturing. We focus on utilizing students with technical backgrounds to gain a deeper understanding of the founders of startups and to both invest in and support their growth and scaling. In our research on manufacturing, {{company}} stood out prominently. We find your company interesting and would love to learn more, and if you are fundraising.\n\nWould you be open to having a call with us in the next few weeks?\n\nBest,\nVitória Lunardi de Castro\nAnalyst at Hillside Ventures\nvld23001@uconn.edu"
        },
        meeting: {
            to: '{{email}}',
            subject: 'Meeting Request - {{name}}',
            body: 'Dear {{name}},\n\nI would like to schedule a meeting to discuss {{topic}}.\n\nPlease let me know your availability.\n\nThank you,\n[Your name]'
        },
        'thank-you': {
            to: '{{email}}',
            subject: 'Thank you - {{name}}',
            body: 'Dear {{name}},\n\nThank you for your time and consideration.\n\nI appreciate the opportunity.\n\nBest regards,\n[Your name]'
        }
    };
    
    // Handle template selection
    templatePresets.addEventListener('change', function() {
        const selectedTemplate = templates[this.value];
        if (selectedTemplate) {
            emailTo.value = selectedTemplate.to;
            emailSubject.value = selectedTemplate.subject;
            emailBody.value = selectedTemplate.body;
            updateGenerateButton();
        }
        this.value = ''; // Reset dropdown
    });
    
    // Handle clear button
    clearBtn.addEventListener('click', function() {
        emailTo.value = '';
        emailSubject.value = '';
        emailBody.value = '';
        updateGenerateButton();
    });
    
    function updateGenerateButton() {
        const hasFields = emailTo.value && emailSubject.value && emailBody.value;
        const hasData = csvData.length > 0;
        generateBtn.disabled = !hasFields || !hasData;
    }
    
    emailTo.addEventListener('input', updateGenerateButton);
    emailSubject.addEventListener('input', updateGenerateButton);
    emailBody.addEventListener('input', updateGenerateButton);
    
    generateBtn.addEventListener('click', generateEmails);
    previewBtn.addEventListener('click', showTemplatePreview);
}

function updateFieldsList() {
    const container = document.getElementById('fieldsList');
    
    if (columns.length === 0) {
        container.innerHTML = `
            <div class="fallback-message">
                <h4>Upload Data First</h4>
                <p>Available fields will appear here</p>
            </div>`;
        return;
    }
    
    let html = `
        <h4 class="sidebar-title">Available Fields</h4>
        <p class="sidebar-help">Click to insert into template</p>
    `;
    
    columns.forEach(col => {
        const sample = csvData[0] ? csvData[0][col] : '';
        html += `
            <div class="field-item" onclick="insertField('${col}')">
                <div class="field-name">{{${col}}}</div>
                <div class="field-sample">${String(sample).length > 25 ? String(sample).substring(0, 25) + '...' : String(sample)}</div>
            </div>`;
    });
    
    container.innerHTML = html;
}

function insertField(fieldName) {
    const targetInput = document.getElementById(lastFocusedInput);
    
    const placeholder = `{{${fieldName}}}`;
    const start = targetInput.selectionStart || 0;
    const end = targetInput.selectionEnd || 0;
    
    targetInput.value = targetInput.value.substring(0, start) + placeholder + targetInput.value.substring(end);
    targetInput.focus();
    targetInput.setSelectionRange(start + placeholder.length, start + placeholder.length);
    
    // Trigger input event to update generate button
    targetInput.dispatchEvent(new Event('input'));
}

function showTemplatePreview() {
    if (csvData.length === 0) {
        alert('Please upload data first');
        return;
    }
    
    const template = {
        to: document.getElementById('emailTo').value,
        subject: document.getElementById('emailSubject').value,
        body: document.getElementById('emailBody').value
    };
    
    const preview = processTemplate(template, csvData[0]);
    const previewSection = document.getElementById('templatePreview');
    const content = document.getElementById('previewContent');
    
    content.innerHTML = `
        <div style="margin-bottom: 16px;"><strong>To:</strong> ${preview.to}</div>
        <div style="margin-bottom: 16px;"><strong>Subject:</strong> ${preview.subject}</div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
            <strong>Message:</strong><br><br>
            <div style="white-space: pre-wrap; font-family: monospace; line-height: 1.6;">${preview.body}</div>
        </div>
    `;
    
    previewSection.classList.remove('hidden');
}

// === EMAIL GENERATION ===
function generateEmails() {
    const template = {
        to: document.getElementById('emailTo').value,
        subject: document.getElementById('emailSubject').value,
        body: document.getElementById('emailBody').value
    };
    
    emailDrafts = csvData.map((row, index) => {
        const processed = processTemplate(template, row);
        return {
            id: 'draft-' + index,
            ...processed,
            data: row,
            sent: false
        };
    });
    
    updateEmailsTable();
    scrollToResults();
}

function processTemplate(template, data) {
    let result = { ...template };
    
    columns.forEach(col => {
        const placeholder = `{{${col}}}`;
        const value = String(data[col] || '');
        const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
        
        result.to = result.to.replace(regex, value);
        result.subject = result.subject.replace(regex, value);
        result.body = result.body.replace(regex, value);
    });
    
    return result;
}

// === EMAIL MANAGEMENT ===
function updateEmailsTable() {
    const container = document.getElementById('emailsTableContainer');
    
    if (emailDrafts.length === 0) {
        container.innerHTML = `
            <div class="fallback-message">
                <h4>Create Template First</h4>
                <p>Generate emails to see them here</p>
            </div>`;
        return;
    }

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Recipient</th>
                    <th>Subject</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;
    
    emailDrafts.forEach(draft => {
        html += `
            <tr>
                <td>${draft.to}</td>
                <td>${draft.subject}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" onclick="sendEmail('${draft.id}')">${draft.sent ? 'Opened' : 'Open'}</button>
                        <button class="btn-delete" onclick="deleteEmail('${draft.id}')" title="Delete email">×</button>
                    </div>
                </td>
            </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function deleteEmail(draftId) {
    emailDrafts = emailDrafts.filter(draft => draft.id !== draftId);
    updateEmailsTable();
}

function sendEmail(draftId) {
    const draft = emailDrafts.find(d => d.id === draftId);
    if (!draft) return;
    
    const mailtoUrl = `mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    
    // Mark as sent BEFORE opening mailto
    draft.sent = true;
    updateEmailsTable();
    
    // Then open the mailto link
    window.location.href = mailtoUrl;
}

// === NAVIGATION ===
function setupNavigation() {
    let scrollTimeout;
    let userClicked = false;

    // Helper function to update active nav
    function updateActiveNav(activeSection) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${activeSection}`) {
                link.classList.add('active');
            }
        });
    }

    // Smooth scroll for nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                // Set flag to prevent scroll listener interference
                userClicked = true;
                
                // Immediately update active state
                updateActiveNav(targetId);
                
                // Then scroll
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = target.offsetTop - navbarHeight - 20; // 20px buffer
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Reset flag after scroll completes
                setTimeout(() => {
                    userClicked = false;
                }, 1000);
            }
        });
    });

    // Update active nav on scroll
    window.addEventListener('scroll', () => {
        if (userClicked) return; // Don't update during user-initiated scrolling

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const sections = ['upload', 'template', 'results'];
            let current = '';
            
            sections.forEach(section => {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    // Lower the threshold for results section to make it easier to activate
                    const threshold = section === 'results' ? 250 : 120;
                    if (rect.top <= threshold) {
                        current = section;
                    }
                }
            });
            
            if (current) {
                updateActiveNav(current);
            }
        }, 50); // Small delay to reduce flicker
    });
}

function scrollToTemplate() {
    document.getElementById('template').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

function scrollToResults() {
    document.getElementById('results').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}