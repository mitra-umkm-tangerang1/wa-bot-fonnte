export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    console.log("Pesan masuk:", data);

    const sender = data.sender;
    const pesan = (data.pesan || data.message || "").toLowerCase();

    let reply = "";

    // MENU UTAMA
    if (pesan.includes("halo") || pesan.includes("hai") || pesan.includes("menu")) {
      reply =
`Selamat datang di Bems Store

Silakan pilih layanan:
1. Mobile Legends
2. Free Fire
3. PUBG
4. Roblox

Ketik angka yang ingin dibeli.`;
    }

    // PILIH ML
    else if (pesan === "1") {
      reply =
`Topup Mobile Legends

Silakan kirim ID + Server
Contoh: 12345678(1234)`;
    }

    // DEFAULT
    else {
      reply =
`Pesan diterima.

Ketik *menu* untuk melihat daftar layanan.`;
    }

    // Kirim balasan ke WhatsApp
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": process.env.FONNTE_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: sender,
        message: reply
      })
    });

    return res.status(200).json({ status: "ok" });
  }

  res.status(200).send("Webhook aktif");
}