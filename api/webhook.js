let users = {};

const CS_NUMBER = "6285718539571"; // ganti dengan nomor CS kamu

export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    console.log("Pesan masuk:", data);

    const sender = data.sender;
    const pesan = (data.pesan || data.message || "").toLowerCase().trim();

    // Pastikan user tersimpan
    if (!users[sender]) {
      users[sender] = { step: "menu" };
    }

    // ===== MENU UTAMA (hemat limit) =====
    if (pesan === "halo" || pesan === "hai" || pesan === "menu") {
      await kirim(sender,
`Selamat datang di Bems Store

Silakan pilih layanan:
1. Mobile Legends
2. Free Fire
3. PUBG
4. Roblox

Ketik angka yang ingin dibeli.`);

      users[sender].step = "pilih_game";
      return res.status(200).json({ status: "ok" });
    }

    // ===== PILIH GAME =====
    if (users[sender].step === "pilih_game" && ["1","2","3","4"].includes(pesan)) {
      users[sender].game = pesan;
      users[sender].step = "input_id";

      let namaGame = getNamaGame(pesan);

      await kirim(sender,
`Topup ${namaGame}

Silakan kirim ID game kamu
Contoh:
12345678(1234)`);

      return res.status(200).json({ status: "ok" });
    }

    // ===== INPUT ID GAME =====
    if (users[sender].step === "input_id") {
      users[sender].idgame = pesan;
      users[sender].step = "done";

      const namaGame = getNamaGame(users[sender].game);

      // Kirim ke CS
      await kirim(CS_NUMBER,
`ORDER MASUK

Game: ${namaGame}
ID: ${users[sender].idgame}
No Pembeli: ${sender}`);

      // Balas pembeli
      await kirim(sender,
`Pesanan ${namaGame} dengan ID ${users[sender].idgame} sudah diterima.

Admin akan segera memproses ya.`);

      return res.status(200).json({ status: "ok" });
    }

    // ===== DEFAULT =====
    await kirim(sender,
`Pesan diterima.

Ketik *menu* untuk melihat daftar layanan.`);

    return res.status(200).json({ status: "ok" });
  }

  res.status(200).send("Webhook aktif");
}

function getNamaGame(kode) {
  if (kode === "1") return "Mobile Legends";
  if (kode === "2") return "Free Fire";
  if (kode === "3") return "PUBG";
  if (kode === "4") return "Roblox";
  return "-";
}

async function kirim(target, message) {
  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      "Authorization": process.env.FONNTE_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      target,
      message
    })
  });
}