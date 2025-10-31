import TelegramBot from "node-telegram-bot-api"
import farmBpList from "../libs/bpList.json"
import { getUserData, saveUserData } from "../storage/telegramStorage"

type StepData = {
    step: "choose_multipliers" | "done"
    twoX?: boolean
    platinum?: boolean
}

const userSteps = new Map<number, StepData>()

// === Локализация ===
const texts = {
    ru: {
        choose_bonuses: "Выберите активные бонусы перед расчётом BP:",
        bonus_2x: "2x бонус",
        bonus_platinum: "Platinum VIP",
        continue: "Продолжить ▶️",
        no_activities: "❌ Нет выполненных активностей",
        with_bonuses: "📊 С {bonuses}",
        without_bonuses: "📊 Без активных бонусов",
        earned: "💰 Заработано: {earned} BP из {max} возможных.",
        daily_title: "📊 <b>Ваш результат BP</b>",
        active_count: "✅ <b>Активностей:</b> {done} / {total}",
        daily_variants: [
            { name: "Без бонусов", icon: "⚪" },
            { name: "2x бонус", icon: "🔹" },
            { name: "Platinum VIP", icon: "🔸" },
            { name: "2x + Platinum", icon: "💎" },
        ],
        lang_changed_ru: "Язык изменён на русский 🇷🇺",
        lang_changed_uz: "Til o‘zbek tiliga o‘zgartirildi 🇺🇿",
    },
    uz: {
        choose_bonuses: "BP hisoblashdan oldin faol bonuslarni tanlang:",
        bonus_2x: "2x bonus",
        bonus_platinum: "Platinum VIP",
        continue: "Davom etish ▶️",
        no_activities: "❌ Faoliyatlar tanlanmagan",
        with_bonuses: "📊 {bonuses} bilan",
        without_bonuses: "📊 Bonuslarsiz",
        earned: "💰 Topilgan: {earned} BP, jami: {max} BP.",
        daily_title: "📊 <b>BP natijalaringiz</b>",
        active_count: "✅ <b>Faoliyatlar:</b> {done} / {total}",
        daily_variants: [
            { name: "Bonussiz", icon: "⚪" },
            { name: "2x bonus", icon: "🔹" },
            { name: "Platinum VIP", icon: "🔸" },
            { name: "2x + Platinum", icon: "💎" },
        ],
        lang_changed_ru: "Язык изменён на русский 🇷🇺",
        lang_changed_uz: "Til o‘zbek tiliga o‘zgartirildi 🇺🇿",
    },
}

// === Старт ===
export function startBpCalculationFlow(bot: TelegramBot, uid: number) {
    const user = getUserData(uid)
    const lang = user.language || "ru"
    const t = texts[lang]

    userSteps.set(uid, { step: "choose_multipliers" })

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `⬜️ ${t.bonus_2x}`, callback_data: "bpcalc_twoX" },
                    { text: `⬜️ ${t.bonus_platinum}`, callback_data: "bpcalc_platinum" },
                ],
                [{ text: t.continue, callback_data: "bpcalc_next" }],
            ],
        },
    }

    bot.sendMessage(uid, t.choose_bonuses, opts)
}

// === Регистрация команд ===
export function registerBpCalculationCommand(bot: TelegramBot) {
    bot.onText(/^\/bp_calculation$/, (msg) => {
        const uid = msg.from?.id
        if (!uid) return
        startBpCalculationFlow(bot, uid)
    })


    // === Обработка кнопок ===
    bot.on("callback_query", async (query) => {
        const uid = query.from.id
        const data = query.data
        if (!data) return

        const step = userSteps.get(uid)
        if (!step) return

        const user = getUserData(uid)
        const lang = user.language || "ru"
        const t = texts[lang]

        if (data === "bpcalc_twoX") step.twoX = !step.twoX
        else if (data === "bpcalc_platinum") step.platinum = !step.platinum
        else if (data === "bpcalc_next") {
            await calculateUserBp(bot, uid, step)
            userSteps.delete(uid)
            return
        }

        const opts = {
            chat_id: uid,
            message_id: query.message?.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `${step.twoX ? "☑️" : "⬜️"} ${t.bonus_2x}`,
                            callback_data: "bpcalc_twoX",
                        },
                        {
                            text: `${step.platinum ? "☑️" : "⬜️"} ${t.bonus_platinum}`,
                            callback_data: "bpcalc_platinum",
                        },
                    ],
                    [{ text: t.continue, callback_data: "bpcalc_next" }],
                ],
            },
        }

        await bot.editMessageReplyMarkup(opts.reply_markup, {
            chat_id: opts.chat_id,
            message_id: opts.message_id,
        })
    })
}

// === Расчёт BP ===
async function calculateUserBp(bot: TelegramBot, uid: number, step?: StepData) {
    const user = getUserData(uid)
    const lang = user.language || "ru"
    const t = texts[lang]

    const allItems = farmBpList.flatMap((cat) =>
        cat.child.map((c) => ({ ...c, category: cat.name }))
    )

    const activeFarms = allItems.filter((f) => user.farmState[f.id])
    const baseEarnedBp = activeFarms.reduce((s, f) => s + f.bp, 0)
    const baseMaxBp = allItems.reduce((s, f) => s + f.bp, 0)

    let multiplier = 1
    const activeBonuses: string[] = []
    if (step?.twoX) { multiplier *= 2; activeBonuses.push(t.bonus_2x) }
    if (step?.platinum) { multiplier *= 2; activeBonuses.push(t.bonus_platinum) }

    const title =
        activeBonuses.length > 0
            ? t.with_bonuses.replace("{bonuses}", activeBonuses.join(" + "))
            : t.without_bonuses

    const totalBp = baseEarnedBp * multiplier
    const maxBp = baseMaxBp * multiplier

    const farmNames = activeFarms.length
        ? activeFarms.map((f) => `• [${f.category}] ${f.name} — ${f.bp * multiplier} BP`).join("\n")
        : t.no_activities

    await bot.sendMessage(
        uid,
        `${title}\n\n${farmNames}\n\n` +
        t.earned.replace("{earned}", String(totalBp)).replace("{max}", String(maxBp))
    )
}

// === Ежедневный отчёт ===
export async function sendDailyBpReport(bot: TelegramBot, uid: number) {
    const user = getUserData(uid)
    const lang = user.language || "ru"
    const t = texts[lang]

    const allItems = farmBpList.flatMap((cat) =>
        cat.child.map((c) => ({ ...c, category: cat.name }))
    )

    const activeFarms = allItems.filter((f) => user.farmState[f.id])
    const baseEarnedBp = activeFarms.reduce((sum, f) => sum + f.bp, 0)
    const baseMaxBp = allItems.reduce((sum, f) => sum + f.bp, 0)

    const variants = [
        { ...t.daily_variants[0], mult: 1 },
        { ...t.daily_variants[1], mult: 2 },
        { ...t.daily_variants[2], mult: 2 },
        { ...t.daily_variants[3], mult: 4 },
    ]

    const resultLines = variants.map(
        (v) =>
            `${v.icon} ${v.name}: ${baseEarnedBp * v.mult} / ${baseMaxBp * v.mult} BP`
    )

    const message =
        `${t.daily_title}\n\n` +
        t.active_count
            .replace("{done}", String(activeFarms.length))
            .replace("{total}", String(allItems.length)) +
        "\n\n" +
        resultLines.join("\n")

    await bot.sendMessage(uid, message, { parse_mode: "HTML" })

    // 🧹 Сброс состояния
    Object.keys(user.farmState).forEach((key) => {
        user.farmState[key] = false
    })
}

export { userSteps, calculateUserBp }
