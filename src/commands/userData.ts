import TelegramBot from "node-telegram-bot-api"
import fs from "fs"
import path from "path"
import { getUserDataFile } from "../storage/telegramStorage"

export function userDataCommand(bot: TelegramBot, adminId: number) {
    bot.onText(/^\/user_data_list$/, async (msg) => {
        console.log(msg, 'user_data_list');
        const chatId = msg.chat.id

        // 🔐 Только администратор может использовать эту команду
        if (chatId !== adminId) {
            return bot.sendMessage(chatId, "⛔ Эта команда доступна только администратору.")
        }

        const filePath = path.resolve("./userData.json")

        // Проверяем, есть ли файл
        if (!fs.existsSync(filePath)) {
            return bot.sendMessage(chatId, "⚠️ Файл userData.json пока не создан.")
        }

        try {
            // Просто на всякий случай обновляем данные в файле (опционально)
            const data = getUserDataFile()
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")

            await bot.sendDocument(chatId, filePath, {
                caption: `📦 Актуальные данные пользователей (${Object.keys(data).length})`,
            })
        } catch (err) {
            console.error("Ошибка при отправке userData.json:", err)
            await bot.sendMessage(chatId, "❌ Ошибка при отправке файла userData.json")
        }
    })
}
