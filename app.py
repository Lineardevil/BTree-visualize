from flask import Flask, render_template, request, jsonify
import uuid
import random

app = Flask(__name__)

# --- ARCHITECTURE DESIGN ---
student_heap_data = {}
ORDER = 3  # B-Tree bậc 3

SAMPLE_NAMES = ["Nguyễn Văn A", "Trần Thị B", "Lê Văn C", "Phạm Minh D", "Hoàng Anh E", "Vũ Hoài F"]
SAMPLE_MAJORS = ["CNTT", "Kinh Tế", "Cơ Khí", "Ngôn Ngữ Anh", "Luật"]


class BTreeNode:
    def __init__(self, is_leaf=True):
        self.id = str(uuid.uuid4())
        self.keys = []
        self.data_pointers = []
        self.children = []
        self.is_leaf = is_leaf

    def to_dict(self):
        return {
            "id": self.id,
            "keys": self.keys,
            "is_leaf": self.is_leaf,
            "children": [child.to_dict() for child in self.children]
        }


class BTreeIndex:
    def __init__(self):
        self.root = BTreeNode()
        self.steps = []

    def record_step(self, msg, highlight_id=None, warning_node_id=None):
        self.steps.append({
            "msg": msg,
            "tree": self.root.to_dict(),
            "highlight": highlight_id,
            "warning_id": warning_node_id
        })

    def insert(self, mssv, uuid_ptr):
        self.steps = []
        self._insert_recursive(self.root, mssv, uuid_ptr)

        if len(self.root.keys) > ORDER - 1:
            mid_idx = len(self.root.keys) // 2
            mid_key = self.root.keys[mid_idx]

            self.record_step(f"CẢNH BÁO NỔ: Nút gốc bị đầy! Chuẩn bị tách và đẩy {mid_key} lên làm gốc mới.",
                             highlight_id=mid_key, warning_node_id=self.root.id)

            new_root = BTreeNode(is_leaf=False)
            new_root.children.append(self.root)
            self._split_child(new_root, 0)
            self.root = new_root

            self.record_step(f"Đã đẩy {mid_key} lên làm gốc mới.", highlight_id=mid_key)

        self.record_step(f"Hoàn tất chèn {mssv} vào cây Index.", highlight_id=mssv)
        return self.steps

    def _insert_recursive(self, node, mssv, uuid_ptr):
        if mssv in node.keys: return

        if node.is_leaf:
            i = 0
            while i < len(node.keys) and mssv > node.keys[i]:
                i += 1
            node.keys.insert(i, mssv)
            node.data_pointers.insert(i, uuid_ptr)
            self.record_step(f"Duyệt cây: Chèn {mssv} vào Node lá.", highlight_id=mssv)
        else:
            i = len(node.keys) - 1
            while i >= 0 and mssv < node.keys[i]:
                i -= 1
            i += 1

            self._insert_recursive(node.children[i], mssv, uuid_ptr)

            if len(node.children[i].keys) > ORDER - 1:
                mid_idx = len(node.children[i].keys) // 2
                mid_key = node.children[i].keys[mid_idx]

                self.record_step(f"CẢNH BÁO NỔ: Nhánh chứa {mssv} bị đầy! Sẽ tách và đẩy {mid_key} lên nút cha.",
                                 highlight_id=mid_key, warning_node_id=node.children[i].id)
                self._split_child(node, i)
                self.record_step(f"Đã đẩy {mid_key} lên nút cha.", highlight_id=mid_key)

    def _split_child(self, parent, i):
        node = parent.children[i]
        new_node = BTreeNode(node.is_leaf)

        mid_idx = len(node.keys) // 2
        mid_key = node.keys[mid_idx]
        mid_ptr = node.data_pointers[mid_idx]

        new_node.keys = node.keys[mid_idx + 1:]
        new_node.data_pointers = node.data_pointers[mid_idx + 1:]
        node.keys = node.keys[:mid_idx]
        node.data_pointers = node.data_pointers[:mid_idx]

        if not node.is_leaf:
            new_node.children = node.children[mid_idx + 1:]
            node.children = node.children[:mid_idx + 1]

        parent.keys.insert(i, mid_key)
        parent.data_pointers.insert(i, mid_ptr)
        parent.children.insert(i + 1, new_node)

    def search(self, mssv):
        self.steps = []
        result_ptr = self._search_recursive(self.root, mssv)
        return result_ptr, self.steps

    def _search_recursive(self, node, mssv):
        self.record_step(f"Đang kiểm tra nhóm: {node.keys}")
        i = 0
        while i < len(node.keys) and mssv > node.keys[i]:
            i += 1

        if i < len(node.keys) and mssv == node.keys[i]:
            self.record_step(f"Đã tìm thấy {mssv}!", highlight_id=mssv)
            return node.data_pointers[i]

        if node.is_leaf:
            self.record_step(f"Không tìm thấy {mssv} trong cây Index.")
            return None

        return self._search_recursive(node.children[i], mssv)

    def delete(self, mssv):
        self.steps = []
        self._delete_recursive(self.root, mssv)
        if len(self.root.keys) == 0 and not self.root.is_leaf:
            self.root = self.root.children[0]
        self.record_step(f"Hoàn tất xử lý xóa {mssv}.")
        return self.steps

    def _delete_recursive(self, node, key):
        self.record_step(f"Xem xét xóa ở nhóm: {node.keys}")
        idx = 0
        while idx < len(node.keys) and key > node.keys[idx]:
            idx += 1

        if idx < len(node.keys) and key == node.keys[idx]:
            if node.is_leaf:
                node.keys.pop(idx)
                node.data_pointers.pop(idx)
                self.record_step(f"Đã xóa trực tiếp key {key} ở lá.")
            else:
                self._delete_from_non_leaf(node, idx)
        else:
            if node.is_leaf: return

            is_last_child = (idx == len(node.keys))
            if len(node.children[idx].keys) < (ORDER // 2):
                self._fill(node, idx)

            if is_last_child and idx > len(node.keys):
                self._delete_recursive(node.children[idx - 1], key)
                # FIX LỖI BÓNG MA: Dọn dẹp rác rỗng sau khi đệ quy về
                if len(node.children[idx - 1].keys) < (ORDER // 2):
                    self._fill(node, idx - 1)
            else:
                self._delete_recursive(node.children[idx], key)
                # FIX LỖI BÓNG MA: Dọn dẹp rác rỗng sau khi đệ quy về
                if len(node.children[idx].keys) < (ORDER // 2):
                    self._fill(node, idx)

    def _delete_from_non_leaf(self, node, idx):
        key = node.keys[idx]
        # VÁ LỖI LOGIC: Đổi dấu >= thành > để tránh mượn nhầm nhánh rỗng
        if len(node.children[idx].keys) > (ORDER // 2):
            pred_key, pred_ptr = self._get_predecessor(node.children[idx])
            node.keys[idx] = pred_key
            node.data_pointers[idx] = pred_ptr
            self._delete_recursive(node.children[idx], pred_key)
            if len(node.children[idx].keys) < (ORDER // 2):
                self._fill(node, idx)
        elif len(node.children[idx + 1].keys) > (ORDER // 2): # Đổi dấu >= thành >
            succ_key, succ_ptr = self._get_successor(node.children[idx + 1])
            node.keys[idx] = succ_key
            node.data_pointers[idx] = succ_ptr
            self._delete_recursive(node.children[idx + 1], succ_key)
            if len(node.children[idx + 1].keys) < (ORDER // 2):
                self._fill(node, idx + 1)
        else:
            self._merge(node, idx)
            self._delete_recursive(node.children[idx], key)
            if len(node.children[idx].keys) < (ORDER // 2):
                self._fill(node, idx)

    def _fill(self, node, idx):
        # VÁ LỖI LOGIC: Đổi dấu >= thành > để mượn chuẩn xác
        if idx != 0 and len(node.children[idx - 1].keys) > (ORDER // 2):
            self._borrow_from_prev(node, idx)
        elif idx != len(node.keys) and len(node.children[idx + 1].keys) > (ORDER // 2):
            self._borrow_from_next(node, idx)
        else:
            if idx != len(node.keys): self._merge(node, idx)
            else: self._merge(node, idx - 1)

    def _get_predecessor(self, node):
        while not node.is_leaf: node = node.children[-1]
        return node.keys[-1], node.data_pointers[-1]

    def _get_successor(self, node):
        while not node.is_leaf: node = node.children[0]
        return node.keys[0], node.data_pointers[0]


    def _borrow_from_prev(self, node, idx):
        child = node.children[idx]
        sibling = node.children[idx - 1]
        child.keys.insert(0, node.keys[idx - 1])
        child.data_pointers.insert(0, node.data_pointers[idx - 1])
        if not child.is_leaf:
            child.children.insert(0, sibling.children.pop(-1))
        node.keys[idx - 1] = sibling.keys.pop(-1)
        node.data_pointers[idx - 1] = sibling.data_pointers.pop(-1)

    def _borrow_from_next(self, node, idx):
        child = node.children[idx]
        sibling = node.children[idx + 1]
        child.keys.append(node.keys[idx])
        child.data_pointers.append(node.data_pointers[idx])
        if not child.is_leaf:
            child.children.append(sibling.children.pop(0))
        node.keys[idx] = sibling.keys.pop(0)
        node.data_pointers[idx] = sibling.data_pointers.pop(0)

    def _merge(self, node, idx):
        child = node.children[idx]
        sibling = node.children[idx + 1]
        child.keys.append(node.keys.pop(idx))
        child.data_pointers.append(node.data_pointers.pop(idx))
        child.keys.extend(sibling.keys)
        child.data_pointers.extend(sibling.data_pointers)
        if not child.is_leaf:
            child.children.extend(sibling.children)
        node.children.pop(idx + 1)


# --- Khởi tạo hệ thống ---
btree_index = BTreeIndex()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/add_student", methods=["POST"])
def api_add():
    data = request.json
    mssv = str(data['mssv']).zfill(8)

    if any(st['mssv'] == mssv for st in student_heap_data.values()):
        return jsonify({"status": "error", "msg": "MSSV này đã tồn tại trong hệ thống!"})

    student_id = str(uuid.uuid4())
    new_student = {
        "mssv": mssv,
        "name": data.get('name', 'N/A'),
        "gender": data.get('gender', 'Nam'),
        "major": data.get('major', '')
    }

    student_heap_data[student_id] = new_student
    steps = btree_index.insert(mssv, student_id)

    return jsonify({"status": "ok", "steps": steps, "full_heap": list(student_heap_data.values())})


@app.route("/api/add_random", methods=["POST"])
def api_add_random():
    count = request.json.get('count', 1)
    all_steps = []

    for _ in range(count):
        while True:
            rand_mssv = str(random.randint(1, 99999999)).zfill(8)
            if not any(st['mssv'] == rand_mssv for st in student_heap_data.values()):
                break

        student_id = str(uuid.uuid4())
        student_heap_data[student_id] = {
            "mssv": rand_mssv,
            "name": random.choice(SAMPLE_NAMES),
            "gender": random.choice(["Nam", "Nữ"]),
            "major": random.choice(SAMPLE_MAJORS)
        }
        steps = btree_index.insert(rand_mssv, student_id)
        all_steps.extend(steps)

    return jsonify({"status": "ok", "full_heap": list(student_heap_data.values()), "steps": all_steps})


@app.route("/api/get_heap", methods=["GET"])
def api_get_heap():
    return jsonify(list(student_heap_data.values()))


@app.route("/api/search", methods=["POST"])
def api_search():
    mssv = str(request.json['mssv']).zfill(8)
    uuid_ptr, steps = btree_index.search(mssv)

    student_data = None
    if uuid_ptr:
        student_data = student_heap_data.get(uuid_ptr)

    return jsonify({"student": student_data, "steps": steps})


@app.route("/api/delete", methods=["POST"])
def api_delete():
    mssv = str(request.json['mssv']).zfill(8)
    uuid_ptr, _ = btree_index.search(mssv)

    if not uuid_ptr:
        return jsonify({"status": "error", "msg": "Không tìm thấy để xóa!"})

    steps = btree_index.delete(mssv)
    del student_heap_data[uuid_ptr]

    return jsonify({"status": "ok", "steps": steps, "full_heap": list(student_heap_data.values())})


@app.route("/reset", methods=["POST"])
def reset():
    global btree_index, student_heap_data
    btree_index = BTreeIndex()
    student_heap_data = {}
    return jsonify({"msg": "SYSTEM REFRESHED"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)