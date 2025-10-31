import TelegramBot from "node-telegram-bot-api"
import fs from "fs"
import {getUserData, hasUser, saveUserData} from "../storage/telegramStorage"
import {startBpCalculationFlow} from "./bpCalculation"
import {startFarmBpFlow} from "./farmBp"

export function startCommand(bot: TelegramBot, adminId: number) {
    bot.onText(/^\/start$/, async (msg) => {
        const chatId = msg.chat.id
        const firstName = msg.from?.first_name || "друг"
        const username = msg.from?.username ? `@${msg.from.username}` : ""

        const user = getUserData(chatId)

        // Если новый пользователь
        const isNewUser = !hasUser(chatId)
        if (isNewUser) {
            user.name = firstName
            user.username = username
            user.joinedAt = new Date().toISOString()
            await saveUserData(bot, adminId)
        }

        // Если язык ещё не выбран — предлагаем выбрать
        if (!user.language) {
            const keyboard: TelegramBot.InlineKeyboardMarkup = {
                inline_keyboard: [
                    [
                        {text: "🇷🇺 Русский", callback_data: "lang_ru"},
                        {text: "🇺🇿 O‘zbekcha", callback_data: "lang_uz"},
                    ],
                ],
            }

            await bot.sendMessage(chatId, "🌐 Выберите язык / Tilni tanlang:", {
                reply_markup: keyboard,
            })
            return
        }

        // Иначе показываем меню
        sendMainMenu(bot, chatId, user.language, firstName, adminId)
    })

    // === Обработка нажатий inline-кнопок ===
    bot.on("callback_query", async (callbackQuery) => {
        const msg = callbackQuery.message
        if (!msg) return
        const chatId = msg.chat.id
        const data = callbackQuery.data

        const user = getUserData(chatId)
        await bot.answerCallbackQuery(callbackQuery.id)

        if (data === "lang_ru" || data === "lang_uz") {
            user.language = data === "lang_ru" ? "ru" : "uz"
            await saveUserData(bot, adminId)
            await bot.sendMessage(
                chatId,
                user.language === "ru"
                    ? "✅ Язык сохранён: Русский"
                    : "✅ Til saqlandi: O‘zbekcha"
            )
            return sendMainMenu(bot, chatId, user.language, user.name, adminId)
        }

        switch (data) {
            case "bp_calculation":
                startBpCalculationFlow(bot, chatId)
                break
            case "farm_bp":
                startFarmBpFlow(bot, chatId)
                break
            case "user_data_list":
                if (chatId === adminId) {
                    const filePath = "./userData.json"
                    if (fs.existsSync(filePath)) {
                        await bot.sendDocument(chatId, filePath, {
                            caption: "📦 Актуальные данные пользователей",
                        })
                    } else {
                        await bot.sendMessage(chatId, "⚠️ Файл userData.json пока не создан.")
                    }
                } else {
                    await bot.sendMessage(chatId, "⛔ У тебя нет доступа к этой кнопке")
                }
                break
        }
    })
}

function sendMainMenu(
    bot: TelegramBot,
    chatId: number,
    lang: "ru" | "uz",
    firstName: string,
    adminId: number
) {
    const text =
        lang === "ru"
            ? `👋 Привет, ${firstName}!\nВыбери, что хочешь сделать 👇`
            : `👋 Salom, ${firstName}!\nQuyidagi harakatlardan birini tanlang 👇`

    const keyboard: TelegramBot.InlineKeyboardMarkup = {
        inline_keyboard: [
            [
                {
                    text: lang === "ru" ? "🌾 Фарм BP" : "🌾 BP fermasi",
                    callback_data: "farm_bp",
                },
                {
                    text: lang === "ru" ? "📈 Рассчитать BP" : "📈 BP hisoblash",
                    callback_data: "bp_calculation",
                },
            ],
        ],
    }

    if (chatId === adminId) {
        keyboard.inline_keyboard.push([
            {
                text:
                    lang === "ru"
                        ? "📦 Актуальные данные пользователей"
                        : "📦 Foydalanuvchilar ma’lumotlari",
                callback_data: "user_data_list",
            },
        ])
    }

    bot.sendMessage(chatId, text, {reply_markup: keyboard})
}
