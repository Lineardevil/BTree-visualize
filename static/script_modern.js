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
    if (tabId === 'tab-tree') {
        document.querySelector('.nav-tab:nth-child(2)').classList.add('active');
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

    const iconError = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    const iconSuccess = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

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

            if(result.steps && result.steps.length > 0) {
                currentSteps = result.steps;

                if (count === 1) {
                    currentStepIdx = 0;
                    switchTab('tab-tree');
                    startAnimation();
                } else {
                    currentStepIdx = currentSteps.length - 1;
                    switchTab('tab-tree');
                    document.getElementById('statusMsg').innerHTML = `<span><svg class="icon-step" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> ⚡ Đã chèn nhanh ${count} mẫu. Cây đã được cập nhật.</span>`;
                }
            }
        } else {
            showToast(result.msg, "error");
        }
    } catch (e) {
        showToast("Lỗi kết nối server!", "error");
    }
}

// HÀM HỖ TRỢ: Tìm dòng trong bảng, cuộn chuột tới và bôi màu
function highlightTableRow(mssv, type) {
    const rows = document.querySelectorAll('#heapTable tbody tr');
    for (let row of rows) {
        // Cột đầu tiên [0] chứa MSSV
        if (row.cells[0].innerText.trim() === mssv) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Gỡ class cũ nếu có, rồi gắn class mới để kích hoạt hiệu ứng chớp màu
            row.classList.remove('highlight-success', 'highlight-danger');
            void row.offsetWidth; // Mẹo ép trình duyệt chạy lại animation
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

    // Nếu tìm thấy: Bắn thông báo xanh lên trên cùng
    showToast(`Tìm thấy: Sinh viên ${result.student.name}`, "success");

    // KIỂM TRA NGỮ CẢNH: Người dùng đang ở Tab nào?
    const isTableActive = document.getElementById('tab-data').classList.contains('active');

    if (isTableActive) {
        // Nếu ở Record Table -> Nhảy tới dòng đó và bôi màu viền Xanh
        highlightTableRow(mssv, 'success');
    } else {
        // Nếu ở B-Tree -> Khởi chạy Animation vẽ cây như cũ
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

    // Nếu đang ở Table, bôi đỏ cảnh báo dòng sắp xóa trước khi gọi API
    const isTableActive = document.getElementById('tab-data').classList.contains('active');
    if (isTableActive) {
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

        if (isTableActive) {
            // Đợi 0.6s cho hiệu ứng bôi đỏ chạy xong rồi mới xóa dòng khỏi bảng
            setTimeout(() => {
                renderHeapTable(result.full_heap);
            }, 600);
        } else {
            // Nếu ở B-Tree -> Chạy animation gỡ node khỏi cây
            renderHeapTable(result.full_heap); // Cập nhật ngầm
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

    let stepIcon = `<svg class="icon-step" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`;
    if (step.msg.includes("CẢNH BÁO")) {
        stepIcon = `<svg class="icon-step" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else if (step.msg.includes("Đã đẩy")) {
        stepIcon = `<svg class="icon-step" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/><polyline points="18 21 12 15 6 21"/></svg>`;
    } else if (step.msg.includes("Đã tách") || step.msg.includes("Nâng tầng")) {
        stepIcon = `<svg class="icon-step" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (step.msg.includes("Hoàn tất")) {
        stepIcon = `<svg class="icon-step" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    }

    document.getElementById('statusMsg').innerHTML = `<span>Step ${currentStepIdx + 1}: ${stepIcon}${step.msg}</span>`;

    const container = document.getElementById('tree-container');
    const svg = document.getElementById('svg-lines');
    const treeCard = document.querySelector('.tree-card');

    document.querySelectorAll('.node').forEach(n => n.dataset.keep = "false");
    // FIX LỖI MẤT KÍNH LÚP: Chỉ target line bên trong #svg-lines
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
    // FIX LỖI MẤT KÍNH LÚP: Chỉ xóa line bên trong #svg-lines
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
const iconPause = `<svg class="icon-inline" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Tạm dừng`;
const iconPlay = `<svg class="icon-inline" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Tiếp tục`;
const iconReplay = `<svg class="icon-inline" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Chạy lại`;

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

window.onload = function() {
    fetchHeapData();
    switchTab('tab-tree');
};

window.onresize = function() {
    if(document.getElementById('tab-tree').classList.contains('active')) {
        updateTreeUI();
    }
};