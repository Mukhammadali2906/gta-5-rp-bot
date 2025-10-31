import TelegramBot from "node-telegram-bot-api"
import {UserData} from "../types"
import fs from "fs"

const STORAGE_FILE = "./userData.json"
const userStates = new Map<number, UserData>()

// === Загружаем пользователей из pinned message ===
export async function loadUserData(bot: TelegramBot, chatId: number) {
    try {
        // 1️⃣ Пытаемся загрузить pinned message из канала
        const chat = await bot.getChat(chatId)
        const pinned = chat.pinned_message

        if (pinned && pinned.document) {
            const file = await bot.getFileLink(pinned.document.file_id)
            const res = await fetch(file)
            const json = await res.text()
            const data = JSON.parse(json)

            for (const [id, val] of Object.entries(data)) {
                // старые пользователи могут быть без name, username и joinedAt
                const user = val as Partial<UserData>
                userStates.set(Number(id), {
                    id: Number(id),
                    name: user.name ?? "Неизвестный",
                    username: user.username ?? "",
                    joinedAt: user.joinedAt ?? new Date().toISOString(),
                    farmState: user.farmState ?? {},
                })
            }
            console.log("✅ Данные восстановлены из Telegram pinned message")
            return
        }

        // 2️⃣ Если pinned нет — пробуем локальный файл
        if (fs.existsSync(STORAGE_FILE)) {
            const json = fs.readFileSync(STORAGE_FILE, "utf8")
            const data = JSON.parse(json)

            for (const [id, val] of Object.entries(data)) {
                const user = val as Partial<UserData>
                userStates.set(Number(id), {
                    id: Number(id),
                    name: user.name ?? "Неизвестный",
                    username: user.username ?? "",
                    joinedAt: user.joinedAt ?? new Date().toISOString(),
                    farmState: user.farmState ?? {},
                })
            }
            console.log("✅ Данные восстановлены из локального файла")
        }
    } catch (e) {
        console.error("Ошибка при загрузке данных:", e)
    }
}

// === Сохраняем пользователей в Telegram ===
export async function saveUserData(bot: TelegramBot, adminId: number) {
    try {
        const data = Object.fromEntries(userStates)
        const json = JSON.stringify(data, null, 2)
        fs.writeFileSync(STORAGE_FILE, json, "utf8")

        const res = await bot.sendDocument(adminId, STORAGE_FILE, {
            caption: "📦 Актуальные данные пользователей",
        })

        // делаем это сообщение закреплённым (pinned)
        await bot.pinChatMessage(adminId, res.message_id)

        console.log("💾 Данные сохранены и закреплены в Telegram")
    } catch (e) {
        console.error("Ошибка при сохранении данных:", e)
    }
}

// 🔹 Возвращает JSON-объект всех пользователей
export function getUserDataFile(): Record<number, any> {
    if (!fs.existsSync(STORAGE_FILE)) return {}

    try {
        const json = fs.readFileSync(STORAGE_FILE, "utf8")
        return JSON.parse(json)
    } catch (e) {
        console.error("Ошибка при чтении userData.json:", e)
        return {}
    }
}

// === Работа с данными ===
export function getUserData(uid: number): UserData {
    if (!userStates.has(uid)) {
        userStates.set(uid, {
            id: uid,
            name: "Неизвестный",
            username: "",
            joinedAt: new Date().toISOString(),
            farmState: {},
        })
    }
    return userStates.get(uid)!
}

export function setUserFarm(uid: number, farmState: Record<number, boolean>) {
    const user = getUserData(uid)
    user.farmState = farmState
    userStates.set(uid, user)
}

export function getAllUsers(): UserData[] {
    return Array.from(userStates.values())
}

export function hasUser(chatId: number): boolean {
    return userStates.has(chatId)
}

// === Возвращает список всех userId ===
export function getAllUserIds(): number[] {
    return Array.from(userStates.keys())
}

// === Очищает farmState у всех пользователей ===
export function clearAllFarmStates() {
    for (const [uid, user] of userStates.entries()) {
        if (user.farmState) {
            for (const key in user.farmState) {
                user.farmState[key] = false
            }
        } else {
            user.farmState = {}
        }
        userStates.set(uid, user)
    }

    console.log("🧹 Все farmState очищены.")
}
