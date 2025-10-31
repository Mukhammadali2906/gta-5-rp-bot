export interface FarmItem {
    id: number
    name: string
    bp: number
}

export interface UserData {
    id: number
    name: string
    username: string
    joinedAt: string
    farmState: Record<number, boolean> // id предмета -> отмечен ли чекбокс
    language?: "ru" | "uz"
}
