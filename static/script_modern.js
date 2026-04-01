let currentSteps = [];
let currentStepIdx = 0;
let autoPlayTimer = null;
let animationSpeed = 500;
let currentScale = 1;

// ==========================================
// UI CONTROLS & UTILS
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'tab-data') {
        document.querySelector('.nav-tab:nth-child(1)').classList.add('active');
        fetchHeapData();
    }
    if (tabId === 'tab-index') {
        document.querySelector('.nav-tab:nth-child(2)').classList.add('active');
        fetchIndexData();
    }
    if (tabId === 'tab-tree') {
        document.querySelector('.nav-tab:nth-child(3)').classList.add('active');
        updateTreeUI();
    }
}

function renderHeapTable(students) {
    const tbody = document.querySelector('#heapTable tbody');
    const totalCount = document.getElementById('totalCount');
    tbody.innerHTML = '';

    students.forEach(s => {
        tbody.innerHTML += `<tr>
            <td><b style="color:var(--primary)">${s.mssv}</b></td>
            <td>${s.name}</td>
            <td>${s.gender}</td>
            <td>${s.major || '-'}</td>
        </tr>`;
    });
    totalCount.innerText = students.length;
}

function renderIndexTable(entries) {
    const tbody = document.querySelector('#indexTable tbody');
    tbody.innerHTML = '';
    entries.forEach(e => {
        tbody.innerHTML += `<tr>
            <td><span class="badge" style="background:var(--primary)">${e.mssv}</span></td>
            <td style="font-family:monospace; color:#666;">${e.pointer}</td>
        </tr>`;
    });
}

function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconError = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`;
    const iconSuccess = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>`;

    toast.innerHTML = `${type === 'error' ? iconError : iconSuccess} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ==========================================
// API ACTIONS
// ==========================================
async function fetchHeapData() {
    const res = await fetch('/api/get_heap');
    const students = await res.json();
    renderHeapTable(students);
}

async function fetchIndexData() {
    const res = await fetch('/api/get_index');
    const entries = await res.json();
    renderIndexTable(entries);
}

async function insertStudent() {
    const btn = document.getElementById('btnInsert');
    let rawMssv = document.getElementById('inMssv').value.trim();

    if(!rawMssv) return showToast("Vui lòng nhập MSSV!", "error");
    let paddedMssv = rawMssv.padStart(8, '0');

    const data = {
        mssv: paddedMssv,
        name: document.getElementById('inName').value.trim(),
        gender: document.getElementById('inGender').value,
        major: document.getElementById('inMajor').value.trim()
    }

    if(!data.name) return showToast("Vui lòng nhập họ và tên!", "error");

    btn.innerText = "⏳ ĐANG CHÈN...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/add_student', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if(result.status === 'ok') {
            showToast(`Thêm thành công sinh viên ${paddedMssv}`, "success");
            renderHeapTable(result.full_heap);

            if(document.getElementById('tab-index').classList.contains('active')) fetchIndexData();

            document.getElementById('inMssv').value = '';
            document.getElementById('inName').value = '';
            document.getElementById('inMajor').value = '';

            currentSteps = result.steps;
            currentStepIdx = 0;
            switchTab('tab-tree');
            startAnimation();
        } else {
            showToast(result.msg, "error");
        }
    } catch (e) {
        showToast("Lỗi kết nối server!", "error");
    }

    btn.innerText = "CHÈN VÀO HỆ THỐNG";
    btn.disabled = false;
}

async function addRandom(count) {
    try {
        const res = await fetch('/api/add_random', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ count })
        });
        const result = await res.json();

        if (result.status === 'ok') {
            showToast(`Đã thêm thành công ${count} mẫu dữ liệu`, "success");
            renderHeapTable(result.full_heap);
            if(document.getElementById('tab-index').classList.contains('active')) fetchIndexData();

            if(result.steps && result.steps.length > 0) {
                currentSteps = result.steps;

                if (count === 1) {
                    currentStepIdx = 0;
                    switchTab('tab-tree');
                    startAnimation();
                } else {
                    currentStepIdx = currentSteps.length - 1;
                    switchTab('tab-tree');
                    document.getElementById('statusMsg').innerHTML = `<span>⚡ Đã chèn nhanh ${count} mẫu. Cây đã được cập nhật.</span>`;
                }
            }
        } else {
            showToast(result.msg, "error");
        }
    } catch (e) {
        showToast("Lỗi kết nối server!", "error");
    }
}

function highlightTableRow(mssv, type) {
    const tableId = document.getElementById('tab-index').classList.contains('active') ? '#indexTable' : '#heapTable';
    const rows = document.querySelectorAll(`${tableId} tbody tr`);
    for (let row of rows) {
        if (row.cells[0].innerText.trim() === mssv) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.remove('highlight-success', 'highlight-danger');
            void row.offsetWidth;
            row.classList.add(`highlight-${type}`);
            break;
        }
    }
}

async function searchStudent() {
    let rawMssv = document.getElementById('inSearchDelete').value.trim();
    if(!rawMssv) return showToast("Nhập MSSV cần tìm!", "error");

    let mssv = rawMssv.padStart(8, '0');

    const res = await fetch('/api/search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ mssv })
    });
    const result = await res.json();

    if(!result.student) {
        return showToast(`Thất bại: Không tìm thấy mã ${mssv}`, "error");
    }

    showToast(`Tìm thấy: Sinh viên ${result.student.name}`, "success");

    const isTreeActive = document.getElementById('tab-tree').classList.contains('active');

    if (!isTreeActive) {
        highlightTableRow(mssv, 'success');
    } else {
        if(result.steps && result.steps.length > 0) {
            currentSteps = result.steps;
            currentStepIdx = 0;
            startAnimation();
        }
    }
}

async function deleteStudent() {
    let rawMssv = document.getElementById('inSearchDelete').value.trim();
    if(!rawMssv) return showToast("Nhập MSSV cần xóa!", "error");

    let mssv = rawMssv.padStart(8, '0');

    if(!confirm(`⚠ Xác nhận xóa sinh viên ${mssv}?`)) return;

    const isTreeActive = document.getElementById('tab-tree').classList.contains('active');
    if (!isTreeActive) {
        highlightTableRow(mssv, 'danger');
    }

    const res = await fetch('/api/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ mssv })
    });
    const result = await res.json();

    if(result.status === 'ok') {
        showToast(`Đã xóa thành công sinh viên ${mssv}`, "success");
        document.getElementById('inSearchDelete').value = '';

        if (!isTreeActive) {
            setTimeout(() => {
                renderHeapTable(result.full_heap);
                if(document.getElementById('tab-index').classList.contains('active')) fetchIndexData();
            }, 600);
        } else {
            renderHeapTable(result.full_heap);
            currentSteps = result.steps;
            currentStepIdx = 0;
            startAnimation();
        }
    } else {
        showToast(`Không tìm thấy để xóa!`, "error");
    }
}

async function resetSystem() {
    if(!confirm("WARNING: Reset toàn bộ dữ liệu hệ thống?")) return;
    await fetch('/reset', { method: 'POST' });
    location.reload();
}

// ==========================================
// B-TREE VISUALIZER ENGINE
// ==========================================
function getTreeDepth(node) {
    if (!node) return 0;
    if (node.is_leaf || !node.children || node.children.length === 0) return 1;
    let max = 0;
    node.children.forEach(c => {
        max = Math.max(max, getTreeDepth(c));
    });
    return 1 + max;
}

function calculateSubtreeWidth(node) {
    if (!node) return 0;
    const MIN_NODE_WIDTH = 250;
    const GAP = 50;

    if (node.is_leaf || !node.children || node.children.length === 0) {
        node.subtreeWidth = MIN_NODE_WIDTH;
        return node.subtreeWidth;
    }

    let totalWidth = 0;
    node.children.forEach((child, index) => {
        totalWidth += calculateSubtreeWidth(child);
        if (index < node.children.length - 1) {
            totalWidth += GAP;
        }
    });

    node.subtreeWidth = Math.max(MIN_NODE_WIDTH, totalWidth);
    return node.subtreeWidth;
}

function isIdInTree(node, id) {
    if (!node) return false;
    if (node.keys.includes(id)) return true;
    if (node.children) {
        for (let c of node.children) {
            if (isIdInTree(c, id)) return true;
        }
    }
    return false;
}

function updateTreeUI() {
    if (currentSteps.length === 0) return;

    const step = currentSteps[currentStepIdx];
    if (!step) return;

    let stepIcon = `<svg class="icon-step" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>`;

    document.getElementById('statusMsg').innerHTML = `<span>Step ${currentStepIdx + 1}: ${stepIcon} ${step.msg}</span>`;

    const container = document.getElementById('tree-container');
    const svg = document.getElementById('svg-lines');
    const treeCard = document.querySelector('.tree-card');

    document.querySelectorAll('.node').forEach(n => n.dataset.keep = "false");
    document.querySelectorAll('#svg-lines line').forEach(l => l.dataset.keep = "false");

    const requiredWidth = calculateSubtreeWidth(step.tree);
    const depth = getTreeDepth(step.tree);

    const availableWidth = treeCard.clientWidth - 40;
    let finalScale = currentScale;
    let isAutoFitted = false;

    if (currentScale === 1 && requiredWidth > availableWidth) {
        finalScale = availableWidth / requiredWidth;
        if (finalScale < 0.2) finalScale = 0.2;
        isAutoFitted = true;
    }

    container.style.zoom = finalScale;

    const drawWidth = requiredWidth;
    const drawHeight = depth * 120 + 100;

    container.style.width = `${drawWidth}px`;
    container.style.height = `${drawHeight}px`;
    svg.style.width = `${drawWidth}px`;
    svg.style.height = `${drawHeight}px`;

    const startX = 0;
    const isLastStep = currentStepIdx === currentSteps.length - 1;
    const isPushUpStep = step.msg.includes("Đã đẩy");

    drawNodeReconcile(step.tree, startX, startX + requiredWidth, 40, step.highlight, step.warning_id, isLastStep, null, isPushUpStep);

    document.querySelectorAll('.node[data-keep="false"]').forEach(n => n.remove());
    document.querySelectorAll('#svg-lines line[data-keep="false"]').forEach(l => l.remove());

    setTimeout(() => {
        const activeNode = container.querySelector('.warning-node') || container.querySelector('.active-node') || container.querySelector('.success-node');
        if (activeNode && !isAutoFitted && currentScale !== 1) {
            const scrollX = (activeNode.offsetLeft * finalScale) - (treeCard.clientWidth / 2);
            treeCard.scrollTo({ left: scrollX, behavior: 'smooth' });
        } else if (isAutoFitted) {
            treeCard.scrollTo({ left: 0 });
        }
    }, 50);
}

function drawNodeReconcile(node, xLeft, xRight, y, highlightId, warningId, isLastStep, parentId = null, isPushUpStep = false) {
    const container = document.getElementById('tree-container');
    const svg = document.getElementById('svg-lines');

    const nodeId = `node-${node.id}`;
    let nodeEl = document.getElementById(nodeId);

    const xCenter = (xLeft + xRight) / 2;
    const hasHighlight = highlightId && node.keys.includes(highlightId);
    const isWarning = (warningId === node.id);

    if (!nodeEl) {
        nodeEl = document.createElement('div');
        nodeEl.id = nodeId;
        if (parentId) {
            const parentEl = document.getElementById(parentId);
            if (parentEl) {
                nodeEl.style.left = parentEl.style.left;
                nodeEl.style.top = parentEl.style.top;
            }
        } else {
            nodeEl.style.left = `${xCenter}px`;
            nodeEl.style.top = `0px`;
        }
        nodeEl.style.opacity = '0';
        nodeEl.style.transform = 'translateX(-50%) scale(0.5)';
        container.appendChild(nodeEl);
    }

    nodeEl.innerHTML = '';
    node.keys.forEach(key => {
        const kBox = document.createElement('div');
        let classes = 'key-box';
        if (key == highlightId) {
            classes += ' highlight-key';
            if (isPushUpStep) {
                classes += ' push-up-key';
            }
        }
        kBox.className = classes;
        kBox.innerText = key;
        nodeEl.appendChild(kBox);
    });

    nodeEl.dataset.keep = "true";

    let classes = 'node';
    if (isWarning) {
        classes += ' warning-node';
    } else if (hasHighlight && !isPushUpStep) {
        if (isLastStep) classes += ' success-node';
        else classes += ' active-node';
    }
    nodeEl.className = classes;

    requestAnimationFrame(() => {
        nodeEl.style.left = `${xCenter}px`;
        nodeEl.style.top = `${y}px`;
        nodeEl.style.opacity = '1';

        if (isWarning) {
            nodeEl.style.transform = 'translateX(-50%) scale(1.15)';
        } else if (hasHighlight && !isPushUpStep) {
            nodeEl.style.transform = 'translateX(-50%) scale(1.1)';
        } else {
            nodeEl.style.transform = 'translateX(-50%) scale(1)';
        }
    });

    if (!node.is_leaf && node.children) {
        let currentX = xCenter - (node.subtreeWidth / 2);
        const GAP = 50;
        const keyWidth = 96;
        const totalKeys = node.keys.length;
        const parentLeftX = xCenter - ((totalKeys * keyWidth) / 2);

        node.children.forEach((child, i) => {
            const childWidth = child.subtreeWidth;
            const childXLeft = currentX;
            const childXRight = currentX + childWidth;
            const childXCenter = (childXLeft + childXRight) / 2;
            const childY = y + 120;
            const startX = parentLeftX + (i * keyWidth);

            const lineId = `line-${nodeId}-to-${child.id}`;
            let line = document.getElementById(lineId);

            if (!line) {
                line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.id = lineId;
                line.setAttribute("x1", startX);
                line.setAttribute("y1", y + 42);
                line.setAttribute("x2", startX);
                line.setAttribute("y2", y + 42);
                svg.appendChild(line);
            }

            line.dataset.keep = "true";

            const isActivePath = highlightId && isIdInTree(child, highlightId);
            if (isActivePath) {
                line.setAttribute('class', isLastStep ? 'success-line' : 'active-line');
                svg.appendChild(line);
            } else {
                line.setAttribute('class', '');
                svg.insertBefore(line, svg.firstChild);
            }

            requestAnimationFrame(() => {
                line.setAttribute("x1", startX);
                line.setAttribute("y1", y + 42);
                line.setAttribute("x2", childXCenter);
                line.setAttribute("y2", childY);
            });

            drawNodeReconcile(child, childXLeft, childXRight, childY, highlightId, warningId, isLastStep, nodeId, isPushUpStep);
            currentX += childWidth + GAP;
        });
    }
}

// ==========================================
// ANIMATION CONTROLS
// ==========================================
const iconPause = `<svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Tạm dừng`;
const iconPlay = `<svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Tiếp tục`;
const iconReplay = `<svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Chạy lại`;

function updateSpeed(sliderValue) {
    const delays = [2000, 1600, 1200, 900, 700, 500, 300, 150, 100, 50];
    animationSpeed = delays[sliderValue - 1];

    if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = setInterval(playNextStep, animationSpeed);
    }
}

function startAnimation() {
    if(autoPlayTimer) clearInterval(autoPlayTimer);
    document.getElementById('btnPlay').innerHTML = iconPause;

    if (currentStepIdx >= currentSteps.length - 1) {
        document.getElementById('btnPlay').innerHTML = iconReplay;
        return;
    }
    autoPlayTimer = setInterval(playNextStep, animationSpeed);
}

function playNextStep() {
    if (currentSteps.length === 0) { clearInterval(autoPlayTimer); return; }

    if (currentStepIdx < currentSteps.length - 1) {
        currentStepIdx++;
        updateTreeUI();
    }

    if (currentStepIdx >= currentSteps.length - 1) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        document.getElementById('btnPlay').innerHTML = iconReplay;
    }
}

function togglePlay() {
    if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        document.getElementById('btnPlay').innerHTML = iconPlay;
    } else {
        if(currentStepIdx >= currentSteps.length -1) {
            currentStepIdx = 0;
            updateTreeUI();
        }
        startAnimation();
    }
}

function zoomTree(delta) {
    if (currentSteps.length === 0) return;

    const treeCard = document.querySelector('.tree-card');
    const step = currentSteps[currentStepIdx];
    if (!step) return;

    const requiredWidth = calculateSubtreeWidth(step.tree);
    const availableWidth = treeCard.clientWidth - 40;

    if (currentScale === 1 && requiredWidth > availableWidth) {
        let autoScale = availableWidth / requiredWidth;
        if (autoScale < 0.2) autoScale = 0.2;
        currentScale = autoScale;
    }

    currentScale += delta;

    if (currentScale < 0.2) currentScale = 0.2;
    if (currentScale > 2.5) currentScale = 2.5;

    updateTreeUI();
}

function autoFitTree() {
    currentScale = 1;
    updateTreeUI();
}

// --- MỚI: TỐI ƯU HÓA LOAD TRANG CHO VERCEL (GỘP 3 YÊU CẦU LÀM 1) ---
window.onload = async function() {
    try {
        const res = await fetch('/api/init_data');
        const data = await res.json();

        // 1. Cập nhật Bảng Gốc
        renderHeapTable(data.heap);

        // 2. Cập nhật Bảng Index
        renderIndexTable(data.index);

        // 3. Nạp và vẽ Cây B-Tree
        currentSteps = [data.tree];
        currentStepIdx = 0;
        switchTab('tab-tree');
    } catch (e) {
        console.error("Lỗi khởi tạo hệ thống từ Server:", e);
    }
};

window.onresize = function() {
    if(document.getElementById('tab-tree').classList.contains('active')) {
        updateTreeUI();
    }
};