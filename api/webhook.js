export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    console.log("Pesan masuk:", data);

    const sender = data.sender;

    // Kirim balasan ke WhatsApp
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": process.env.FONNTE_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: sender,
        message: "Halo, pesan kamu sudah masuk ke bot 🤖"
      })
    });

    return res.status(200).json({ status: "ok" });
  }

  res.status(200).send("Webhook aktif");
}