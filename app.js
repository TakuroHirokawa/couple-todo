"use strict";

// ============ Firebase設定 ============
// Firebase Consoleから取得した設定をここに貼り付けてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID",
};

// ============ Firebase初期化 ============
let db = null;
let roomRef = null;
let useFirebase = false;

function initFirebase() {
  try {
    if (
      typeof firebase !== "undefined" &&
      firebaseConfig.apiKey !== "YOUR_API_KEY"
    ) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      useFirebase = true;
      updateSyncStatus("online", "リアルタイム同期: ON");
    } else {
      useFirebase = false;
      updateSyncStatus("offline", "ローカルモード（Firebase未設定）");
    }
  } catch (e) {
    useFirebase = false;
    updateSyncStatus("offline", "ローカルモード（Firebase接続エラー）");
  }
}

function updateSyncStatus(state, text) {
  const el = document.getElementById("sync-status");
  if (el) {
    el.textContent = text;
    el.className = "sync-status " + state;
  }
}

// ============ カテゴリラベル ============
const categoryLabels = {
  shopping: "買い物",
  housework: "家事",
  schedule: "予定",
  other: "その他",
};

// ============ セットアップ ============
let config = JSON.parse(localStorage.getItem("couple-todo-config") || "null");

function showSetup() {
  document.getElementById("setup-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";

  // 保存済みの値を復元
  if (config) {
    document.getElementById("room-id").value = config.roomId || "";
    document.getElementById("my-name").value = config.myName || "";
    document.getElementById("partner-name").value = config.partnerName || "";
  }
}

function showApp() {
  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("app").style.display = "block";

  // UIに名前を反映
  document.getElementById("room-info").textContent =
    "Room: " + config.roomId + " | " + config.myName + " & " + config.partnerName;

  // 担当者セレクトを更新
  const assigneeSelect = document.getElementById("assignee-select");
  assigneeSelect.innerHTML =
    '<option value="">担当者</option>' +
    '<option value="partner1">' + config.myName + "</option>" +
    '<option value="partner2">' + config.partnerName + "</option>";

  // フィルターボタンのラベル更新
  document.getElementById("filter-p1").textContent = config.myName;
  document.getElementById("filter-p2").textContent = config.partnerName;

  startApp();
}

document.getElementById("setup-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const roomId = document.getElementById("room-id").value.trim();
  const myName = document.getElementById("my-name").value.trim();
  const partnerName = document.getElementById("partner-name").value.trim();

  if (!roomId || !myName || !partnerName) return;

  config = { roomId: roomId, myName: myName, partnerName: partnerName };
  localStorage.setItem("couple-todo-config", JSON.stringify(config));
  showApp();
});

document.getElementById("logout-btn").addEventListener("click", function () {
  if (confirm("設定をリセットしますか？")) {
    // Firebase リスナー解除
    if (roomRef) {
      roomRef.off();
      roomRef = null;
    }
    localStorage.removeItem("couple-todo-config");
    config = null;
    todos = [];
    showSetup();
  }
});

// ============ アプリ本体 ============
let todos = [];
let filterStatus = "all";
let filterAssignee = "all";
let filterCategory = "all";

function startApp() {
  initFirebase();

  if (useFirebase) {
    roomRef = db.ref("rooms/" + config.roomId + "/todos");
    // リアルタイムリスナー
    roomRef.on("value", function (snapshot) {
      const data = snapshot.val();
      todos = data ? Object.values(data) : [];
      renderTodos();
    });
  } else {
    // ローカルモード: ルームIDごとにlocalStorageに保存
    const key = "couple-todos-" + config.roomId;
    todos = JSON.parse(localStorage.getItem(key) || "[]");
    renderTodos();
  }
}

function saveTodos() {
  if (useFirebase && roomRef) {
    const data = {};
    todos.forEach(function (t) {
      data[t.id] = t;
    });
    roomRef.set(data);
  } else {
    const key = "couple-todos-" + config.roomId;
    localStorage.setItem(key, JSON.stringify(todos));
  }
}

// ============ レンダリング ============
function renderTodos() {
  var list = document.getElementById("todo-list");
  var countEl = document.getElementById("todo-count");
  list.innerHTML = "";

  var filtered = todos.filter(function (t) {
    if (filterStatus === "active" && t.done) return false;
    if (filterStatus === "completed" && !t.done) return false;
    if (filterAssignee !== "all" && t.assignee !== filterAssignee) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  filtered.forEach(function (todo) {
    var li = document.createElement("li");
    li.className = "todo-item";
    if (todo.done) li.className += " completed";
    if (todo.assignee) li.className += " " + todo.assignee;

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", function () {
      todo.done = checkbox.checked;
      saveTodos();
      if (!useFirebase) renderTodos();
    });

    var content = document.createElement("div");
    content.className = "todo-content";

    var span = document.createElement("span");
    span.className = "todo-text";
    span.textContent = todo.text;
    content.appendChild(span);

    var meta = document.createElement("div");
    meta.className = "todo-meta";

    if (todo.assignee) {
      var assigneeBadge = document.createElement("span");
      assigneeBadge.className = "badge badge-assignee " + todo.assignee;
      assigneeBadge.textContent =
        todo.assignee === "partner1" ? config.myName : config.partnerName;
      meta.appendChild(assigneeBadge);
    }

    if (todo.category) {
      var catBadge = document.createElement("span");
      catBadge.className = "badge badge-category";
      catBadge.setAttribute("data-cat", todo.category);
      catBadge.textContent = categoryLabels[todo.category] || todo.category;
      meta.appendChild(catBadge);
    }

    content.appendChild(meta);

    var delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "\u00d7";
    delBtn.addEventListener("click", function () {
      if (useFirebase && roomRef) {
        roomRef.child(String(todo.id)).remove();
      } else {
        todos = todos.filter(function (t) {
          return t.id !== todo.id;
        });
        saveTodos();
        renderTodos();
      }
    });

    li.append(checkbox, content, delBtn);
    list.appendChild(li);
  });

  var remaining = todos.filter(function (t) {
    return !t.done;
  }).length;
  countEl.textContent = remaining > 0 ? remaining + " 件の未完了タスク" : "";
}

// ============ タスク追加 ============
document.getElementById("todo-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var input = document.getElementById("todo-input");
  var text = input.value.trim();
  if (!text) return;

  var assignee = document.getElementById("assignee-select").value;
  var category = document.getElementById("category-select").value;

  var todo = {
    id: Date.now(),
    text: text,
    done: false,
    assignee: assignee || "",
    category: category,
    createdBy: config.myName,
    createdAt: new Date().toISOString(),
  };

  if (useFirebase && roomRef) {
    roomRef.child(String(todo.id)).set(todo);
  } else {
    todos.push(todo);
    saveTodos();
    renderTodos();
  }

  input.value = "";
});

// ============ フィルター ============
// ステータスフィルター
document.querySelectorAll("[data-filter]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    filterStatus = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    renderTodos();
  });
});

// 担当者フィルター
document.querySelectorAll("[data-assignee]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    filterAssignee = btn.dataset.assignee;
    document.querySelectorAll("[data-assignee]").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    renderTodos();
  });
});

// カテゴリフィルター
document.querySelectorAll("[data-category]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    filterCategory = btn.dataset.category;
    document.querySelectorAll("[data-category]").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    renderTodos();
  });
});

// ============ 起動 ============
if (config) {
  showApp();
} else {
  showSetup();
}
