import TelegramBot from "node-telegram-bot-api"
import farmBpList from "../libs/bpList.json"
import { getUserData, setUserFarm } from "../storage/telegramStorage"
import {UserData} from "../types";

// === Состояния пользователя ===
const farmUserSteps = new Map<number, string | null>() // categoryId или null (главное меню)

// === Вспомогательная функция перевода ===
function t(userLang: string | undefined, ru: string, uz: string): string {
    return userLang === "uz" ? uz : ru
}

// === Клавиатура категорий ===
function buildCategoryKeyboard(userLang: string | undefined) {
    return {
        inline_keyboard: farmBpList.map((cat) => [
            {
                text: `📂 ${userLang === "uz" ? cat.nameUz || cat.name : cat.name}`,
                callback_data: `open_cat_${cat.id}`,
            },
        ]),
    }
}

// === Клавиатура активностей внутри категории ===
function buildChildKeyboard(user: UserData, categoryId: number) {
    const category = farmBpList.find((c) => c.id === categoryId)
    if (!category) return { inline_keyboard: [] }

    const userLang = user.language
    const inline_keyboard: TelegramBot.InlineKeyboardButton[][] = category.child.map((item) => [
        {
            text: `${user.farmState[item.id] ? "✅" : "⬜"} ${
                userLang === "uz" ? item.nameUz || item.name : item.name
            }`,
            callback_data: `farm_toggle_${item.id}`,
        },
    ])

    // Добавляем кнопку "Назад"
    inline_keyboard.push([
        { text: t(userLang, "⬅️ Назад", "⬅️ Orqaga"), callback_data: "back_to_categories" },
    ])

    return { inline_keyboard }
}

// === Отправка начального списка категорий ===
export function startFarmBpFlow(bot: TelegramBot, uid: number) {
    const user = getUserData(uid)
    const keyboard = buildCategoryKeyboard(user.language)
    farmUserSteps.set(uid, null) // в главном меню

    bot.sendMessage(
        uid,
        t(user.language, "Выберите категорию:", "Kategoriyani tanlang:"),
        { reply_markup: keyboard }
    )
}

// === Регистрация команды /farm_bp ===
export function registerFarmBpCommand(bot: TelegramBot) {
    bot.onText(/^\/farm_bp$/, (msg) => {
        const uid = msg.from?.id
        if (!uid) return
        startFarmBpFlow(bot, uid)
    })

    bot.on("callback_query", async (query) => {
        if (!query.data || !query.from?.id) return
        const uid = query.from.id
        const user = getUserData(uid)
        const currentStep = farmUserSteps.get(uid)

        // === Открытие категории ===
        if (query.data.startsWith("open_cat_")) {
            const categoryId = Number(query.data.replace("open_cat_", ""))
            farmUserSteps.set(uid, String(categoryId))

            const keyboard = buildChildKeyboard(user, categoryId)

            if (query.message) {
                await bot.editMessageText(
                    `📂 ${
                        user.language === "uz"
                            ? farmBpList.find((c) => c.id === categoryId)?.nameUz ||
                            farmBpList.find((c) => c.id === categoryId)?.name
                            : farmBpList.find((c) => c.id === categoryId)?.name
                    }`,
                    {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        reply_markup: keyboard,
                    }
                )
            }

            await bot.answerCallbackQuery(query.id)
            return
        }

        // === Назад к списку категорий ===
        if (query.data === "back_to_categories") {
            farmUserSteps.set(uid, null)
            const keyboard = buildCategoryKeyboard(user.language)

            if (query.message) {
                await bot.editMessageText(
                    t(user.language, "Выберите категорию:", "Kategoriyani tanlang:"),
                    {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        reply_markup: keyboard,
                    }
                )
            }

            await bot.answerCallbackQuery(query.id)
            return
        }

        // === Тоггл активности ===
        if (query.data.startsWith("farm_toggle_")) {
            const id = Number(query.data.replace("farm_toggle_", ""))
            user.farmState[id] = !user.farmState[id]
            setUserFarm(uid, user.farmState)

            const categoryId = currentStep ? Number(currentStep) : null
            if (categoryId) {
                const keyboard = buildChildKeyboard(user, categoryId)

                if (query.message) {
                    await bot.editMessageReplyMarkup(keyboard, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                    })
                }
            }

            await bot.answerCallbackQuery(query.id)
        }
    })
}

export { farmUserSteps }
