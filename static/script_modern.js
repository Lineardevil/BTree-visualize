let currentSteps = [];
let currentStepIdx = 0;
let autoPlayTimer = null;
let animationSpeed = 700;
let currentScale = 1;

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

async function fetchHeapData() {
    const res = await fetch('/api/get_heap');
    const students = await res.json();
    renderHeapTable(students);
}

// --- CÁC HÀNH ĐỘNG API ---

async function insertStudent() {
    const btn = document.getElementById('btnInsert');

    // Tiền xử lý dữ liệu nhập
    let rawMssv = document.getElementById('inMssv').value.trim();
    if(!rawMssv) return alert("❌ Vui lòng nhập MSSV!");

    // TỰ ĐỘNG THÊM SỐ 0 VÀO TRƯỚC NẾU NHẬP THIẾU 8 SỐ
    let paddedMssv = rawMssv.padStart(8, '0');

    const data = {
        mssv: paddedMssv,
        name: document.getElementById('inName').value.trim(),
        gender: document.getElementById('inGender').value,
        major: document.getElementById('inMajor').value.trim()
        // Đã xóa trường birthday
    }

    if(!data.name) return alert("❌ Vui lòng nhập họ và tên!");

    btn.innerText = "⏳ ĐANG CHÈN..."; btn.disabled = true;

    try {
        const res = await fetch('/api/add_student', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if(result.status === 'ok') {
            renderHeapTable(result.full_heap);
            document.getElementById('inMssv').value = '';
            document.getElementById('inName').value = '';
            document.getElementById('inMajor').value = ''; // Clear thêm ô chuyên ngành

            currentSteps = result.steps;
            currentStepIdx = 0;
            switchTab('tab-tree');
            startAnimation();
        } else {
            alert(result.msg);
        }
    } catch (e) { alert("Lỗi kết nối server!"); }
    btn.innerText = "CHÈN VÀO HỆ THỐNG"; btn.disabled = false;
}

async function addRandom(count) {
    const res = await fetch('/api/add_random', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ count })
    });
    const result = await res.json();

    if (result.status === 'ok') {
        renderHeapTable(result.full_heap);
        if(result.steps && result.steps.length > 0) {
            currentSteps = result.steps;

            if (count === 1) {
                currentStepIdx = 0;
                switchTab('tab-tree');
                startAnimation();
            } else {
                currentStepIdx = currentSteps.length - 1;
                if(document.getElementById('tab-tree').classList.contains('active')) {
                    updateTreeUI();
                } else {
                    document.getElementById('statusMsg').innerHTML = `>> Đã thêm ${count} mẫu dữ liệu. Cây đã được cập nhật.`;
                }
            }
        }
    }
}

async function searchStudent() {
    let rawMssv = document.getElementById('inSearchDelete').value.trim();
    if(!rawMssv) return;

    // Tự động bù số 0 để tìm đúng
    let mssv = rawMssv.padStart(8, '0');

    const res = await fetch('/api/search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ mssv })
    });
    const result = await res.json();

    const box = document.getElementById('quickSearchResult');
    if(result.student) {
        const s = result.student;
        box.innerHTML = `✅ <b>FOUND: ${s.name}</b><br><small>${s.gender} | ${s.major || 'Không có ngành'}</small>`;
    } else {
        box.innerHTML = `❌ Không tìm thấy mã ${mssv}`;
    }

    if(result.steps && result.steps.length > 0) {
        currentSteps = result.steps;
        currentStepIdx = 0;
        switchTab('tab-tree');
        startAnimation();
    }
}

async function deleteStudent() {
    let rawMssv = document.getElementById('inSearchDelete').value.trim();
    if(!rawMssv) return;
    let mssv = rawMssv.padStart(8, '0');

    if(!confirm(`⚠️ Xác nhận xóa sinh viên ${mssv}?`)) return;

    const res = await fetch('/api/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ mssv })
    });
    const result = await res.json();

    if(result.status === 'ok') {
        renderHeapTable(result.full_heap);
        document.getElementById('inSearchDelete').value = '';
        document.getElementById('quickSearchResult').innerHTML = '';

        currentSteps = result.steps;
        currentStepIdx = 0;
        switchTab('tab-tree');
        startAnimation();
    } else {
        alert(result.msg);
    }
}

// --- VISUALIZER ENGINE ---
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
    // Chú ý: Vì mssv bây giờ lưu là chuỗi (String), ta so sánh trực tiếp không cần Number()
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
    document.getElementById('statusMsg').innerHTML = `>> Step ${currentStepIdx + 1}: ${step.msg}`;

    const container = document.getElementById('tree-container');
    const svg = document.getElementById('svg-lines');
    const treeCard = document.querySelector('.tree-card');

    document.querySelectorAll('.node').forEach(n => n.dataset.keep = "false");
    document.querySelectorAll('line').forEach(l => l.dataset.keep = "false");

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
    document.querySelectorAll('line[data-keep="false"]').forEach(l => l.remove());

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
    // So sánh chuỗi trực tiếp
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

        node.children.forEach((child) => {
            const childWidth = child.subtreeWidth;
            const childXLeft = currentX;
            const childXRight = currentX + childWidth;
            const childXCenter = (childXLeft + childXRight) / 2;
            const childY = y + 120;

            const lineId = `line-${nodeId}-to-${child.id}`;
            let line = document.getElementById(lineId);

            if (!line) {
                line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.id = lineId;
                line.setAttribute("x1", xCenter);
                line.setAttribute("y1", y + 42);
                line.setAttribute("x2", xCenter);
                line.setAttribute("y2", y + 42);
                svg.appendChild(line);
            }

            line.dataset.keep = "true";

            // Truyền string vào isIdInTree
            const isActivePath = highlightId && isIdInTree(child, highlightId);
            if (isActivePath) {
                line.setAttribute('class', isLastStep ? 'success-line' : 'active-line');
                svg.appendChild(line);
            } else {
                line.setAttribute('class', '');
                svg.insertBefore(line, svg.firstChild);
            }

            requestAnimationFrame(() => {
                line.setAttribute("x1", xCenter);
                line.setAttribute("y1", y + 42);
                line.setAttribute("x2", childXCenter);
                line.setAttribute("y2", childY);
            });

            drawNodeReconcile(child, childXLeft, childXRight, childY, highlightId, warningId, isLastStep, nodeId, isPushUpStep);
            currentX += childWidth + GAP;
        });
    }
}

// --- ANIMATION CONTROLS ---
// CÁC HẰNG SỐ CHỨA MÃ SVG CHO NÚT PLAY/PAUSE
const iconPause = `<svg class="icon-inline" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Tạm dừng`;
const iconPlay = `<svg class="icon-inline" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Tiếp tục`;
const iconReplay = `<svg class="icon-inline" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Chạy lại`;

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

function changeSpeed(delta) {
    animationSpeed += delta * 150;
    if(animationSpeed < 100) animationSpeed = 100;
    if(animationSpeed > 2000) animationSpeed = 2000;
    if(autoPlayTimer) startAnimation();
}

function zoomTree(delta) {
    currentScale += delta;
    if (currentScale < 0.2) currentScale = 0.2;
    if (currentScale > 2.5) currentScale = 2.5;
    updateTreeUI();
}

function autoFitTree() {
    currentScale = 1;
    updateTreeUI();
}

async function resetSystem() {
    if(!confirm("🔄 CẢNH BÁO: Reset toàn bộ dữ liệu hệ thống?")) return;
    await fetch('/reset', { method: 'POST' });
    location.reload();
}

window.onload = function() {
    fetchHeapData();
    switchTab('tab-data');
};

window.onresize = function() {
    if(document.getElementById('tab-tree').classList.contains('active')) {
        updateTreeUI();
    }
};