import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { id, phone } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    try {
        const randomMileage = Math.floor(Math.random() * 200) + 50;
        const result = await sql`
            INSERT INTO users (telegram_id, phone, mileage, free_spin_available)
            VALUES (${id}, ${phone}, ${randomMileage}, TRUE)
            ON CONFLICT (telegram_id) 
            DO UPDATE SET phone = ${phone}
            RETURNING mileage, free_spin_available;
        `;
        const user = result.rows[0];
        return res.status(200).json({
            success: true,
            mileage: Number(user.mileage),
            first_spin_done: !user.free_spin_available
        });
    } catch (error) {
        return res.status(500).json({ error: `Ошибка базы: ${error.message}` });
    }
}
