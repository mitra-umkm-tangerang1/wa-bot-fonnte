let users = {};

const CS_NUMBER = "6285718539571"; // nomor CS

// Daftar nominal & harga (bisa kamu ubah)
const pricelist = {
  "1": [ // Mobile Legends
    { kode: "1", nama: "86 DM", harga: 20000 },
    { kode: "2", nama: "172 DM", harga: 39000 },
    { kode: "3", nama: "257 DM", harga: 58000 }
  ],
  "2": [ // Free Fire
    { kode: "1", nama: "70 DM", harga: 10000 },
    { kode: "2", nama: "140 DM", harga: 19000 }
  ],
  "3": [ // PUBG
    { kode: "1", nama: "60 UC", harga: 15000 }
  ],
  "4": [ // Roblox
    { kode: "1", nama: "80 Robux", harga: 16000 }
  ]
};

export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    const sender = data.sender;
    const pesan = (data.pesan || data.message || "").toLowerCase().trim();

    console.log("Pesan masuk:", data);

    if (!users[sender]) users[sender] = { step: "idle" };

    // ===== MENU (balas hanya jika diminta) =====
    if (pesan === "halo" || pesan === "hai" || pesan === "menu") {
      users[sender] = { step: "pilih_game" };

      await kirim(sender,
`Selamat datang di Bems Store

Silakan pilih layanan:
1. Mobile Legends
2. Free Fire
3. PUBG
4. Roblox

Ketik angka.`);
      return res.status(200).json({ status: "ok" });
    }

    // ===== PILIH GAME =====
    if (users[sender].step === "pilih_game" && ["1","2","3","4"].includes(pesan)) {
      users[sender].game = pesan;
      users[sender].step = "input_id";

      await kirim(sender,
`Topup ${getNamaGame(pesan)}

Kirim ID + Server
Contoh:
12345678(1234)`);
      return res.status(200).json({ status: "ok" });
    }

    // ===== INPUT ID =====
    if (users[sender].step === "input_id") {
      users[sender].idgame = pesan;
      users[sender].step = "pilih_nominal";

      const list = pricelist[users[sender].game]
        .map(i => `${i.kode}. ${i.nama} - Rp${i.harga}`)
        .join("\n");

      await kirim(sender,
`Pilih nominal:

${list}

Ketik angka.`);
      return res.status(200).json({ status: "ok" });
    }

    // ===== PILIH NOMINAL =====
    if (users[sender].step === "pilih_nominal") {
      const item = pricelist[users[sender].game].find(i => i.kode === pesan);
      if (!item) return res.status(200).json({ status: "ok" }); // diam jika salah

      users[sender].nominal = item;

      const namaGame = getNamaGame(users[sender].game);

      // Kirim ke CS
      await kirim(CS_NUMBER,
`ORDER MASUK

Game: ${namaGame}
Nominal: ${item.nama}
Harga: Rp${item.harga}
ID: ${users[sender].idgame}
No Pembeli: ${sender}`);

      // Balas pembeli
      await kirim(sender,
`Pesanan diterima

${namaGame}
${item.nama}
Rp${item.harga}

Admin akan proses.`);

      users[sender].step = "idle";
      return res.status(200).json({ status: "ok" });
    }

    // ===== HEMAT EKSTREM: selain kondisi di atas BOT DIAM =====
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