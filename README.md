# Secured Chat

A full‑stack secured chat application built with **Node.js**, **Express**, **MongoDB**, and a static **HTML/CSS/JS frontend**, fully containerized using **Docker Compose**.

This README explains how to **run the project locally**, **using Docker**, and how to **manually promote a user to admin** via MongoDB.

---

## 🧱 Tech Stack

* **Backend:** Node.js + Express
* **Frontend:** Vanilla HTML / CSS / JavaScript (served via Nginx)
* **Database:** MongoDB
* **Auth:** JWT + bcrypt
* **Containerization:** Docker + Docker Compose

---

## 📁 Project Structure

```
.
├── backend/
│   ├── Dockerfile
│   ├── server.js
│   ├── db.js
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   └── .env        # NOT committed
│
├── frontend/
│   ├── Dockerfile
│   ├── pages/
│   │   ├── index.html
│   │   ├── register.html
│   │   ├── rooms.html
│   │   └── chat.html
│   ├── js/
│   └── css/
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Running the App (Docker – Recommended)

### 1️⃣ Prerequisites

Make sure you have installed:

* Docker
* Docker Compose

Verify:

```bash
docker --version
docker compose version
```

---

### 2️⃣ Environment Variables

Create a `.env` file **inside the `backend/` folder**:

```env
PORT=3000
NODE_ENV=development

MONGO_URI=mongodb://mongo:27017/secured_chat

JWT_SECRET=dev-secret

URL_RISK_THRESHOLD=70
DLP_ENABLED=false

GEMINI_API_KEY=
VT_API_KEY=
```

> ⚠️ `.env` **must NOT be committed** (already ignored via `.gitignore`).

---

### 3️⃣ Build & Run Everything

From the **project root**:

```bash
docker compose up --build
```

Services started:

* Frontend → [http://localhost:8080](http://localhost:8080)
* Backend → [http://localhost:3000](http://localhost:3000)
* MongoDB → internal container

---

### 4️⃣ Stop the App

```bash
docker compose down
```

---

## 🔁 Development Workflow

### After changing backend code:

```bash
docker compose restart backend
```

### After changing frontend code:

```bash
docker compose restart frontend
```

### After changing Dockerfiles or dependencies:

```bash
docker compose up --build
```

---

## 🧑‍💻 Using MongoDB (Admin / Debugging)

### Enter Mongo Shell inside Docker

```bash
docker compose exec mongo mongosh
```

---

### Select Database

```js
use secured_chat
```

---

### View Users

```js
db.users.find().pretty()
```

Example document:

```js
{
  _id: ObjectId("..."),
  name: "eliran",
  password: "<hashed>",
  role: "user"
}
```

---

### 🔑 Promote User to Admin

```js
db.users.updateOne(
  { name: "eliran" },
  { $set: { role: "admin" } }
)
```

Verify:

```js
db.users.find({ name: "eliran" })
```

---

## 👮 Admin Capabilities

Admins can:

* Create rooms
* Delete rooms
* Manage chat access

Role is enforced **server‑side**.

---

## 🧪 Troubleshooting

### Mongo connection error

Make sure backend uses:

```env
MONGO_URI=mongodb://mongo:27017/secured_chat
```

(Not `localhost` inside Docker)

---

### 404 on frontend routes

Ensure:

* `index.html` is inside `frontend/pages/`
* Nginx serves `/pages/index.html` as the entry point

---

## 🧹 Cleanup

Remove containers + network (keep DB):

```bash
docker compose down
```

Full reset (⚠️ deletes DB):

```bash
docker compose down -v
```

---

## ✅ Notes

* `.env` is machine‑specific
* Docker handles portability across computers
* Mongo data persists via Docker volume

---

## 📌 Future Improvements

* Hot‑reload for backend (nodemon + volumes)
* Production `.env`
* HTTPS + reverse proxy
* CI pipeline

---

Happy hacking 🚀
