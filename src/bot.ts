import TelegramBot from "node-telegram-bot-api"
import dotenv from "dotenv"
import cron from "node-cron"
import {registerFarmBpCommand} from "./commands/farmBp"
import {registerBpCalculationCommand, sendDailyBpReport} from "./commands/bpCalculation"
import {startCommand} from "./commands/start"
import {clearAllFarmStates, getAllUserIds, loadUserData} from "./storage/telegramStorage"
import {userDataCommand} from "./commands/userData"

dotenv.config()

const TOKEN = process.env.BOT_TOKEN!
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID!)
const bot = new TelegramBot(TOKEN, {polling: true})

// === Загружаем данные пользователей ===
loadUserData(bot, ADMIN_CHAT_ID).then(() => {
    startCommand(bot, ADMIN_CHAT_ID)
    userDataCommand(bot, ADMIN_CHAT_ID)
    registerFarmBpCommand(bot)
    registerBpCalculationCommand(bot)

    // === 📅 Расписание на каждый день в 7:00 утра ===
    // "0 9 * * *
    // */1 * * * *"
    cron.schedule("0 7 * * *", async () => {
        console.log("⏰ Автоотчёт за день (по Москве)...")

        const userIds = getAllUserIds() // функция должна вернуть все userId из хранилища
        for (const uid of userIds) {
            try {
                // вычисляем результат BP и отправляем отчёт
                await sendDailyBpReport(bot, uid)
            } catch (err) {
                console.error(`Ошибка при отправке отчёта пользователю ${uid}:`, err)
            }
        }

        // После отчёта — очистить все состояния активностей
        clearAllFarmStates()
        console.log("✅ Все farmState очищены после отчёта")
    }, {
        timezone: "Europe/Moscow",
    })
})

console.log("🤖 Бот запущен!")
