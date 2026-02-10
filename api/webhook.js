import md5 from "md5";

let users = {};

const CS_NUMBER = "6285718539571";
const PROFIT = 3000;
const MAX_RETRY = 3;
const RATE_LIMIT_MS = 5000;

// ===== KATEGORI ECOMMERCE =====
const CATEGORY_MAP = {
  "1": "PULSA",
  "2": "DATA",
  "3": "PLN",
  "4": "E-MONEY",
  "5": "GAMES"
};

// ================= MAIN =================
export default async function handler(req, res) {
  if (req.method !== "POST") return res.send("OK");

  const { sender, pesan, message, url } = req.body;
  if (!sender) return res.json({ ok:true });

  const text = (pesan || message || "").toLowerCase().trim();

  // ===== INIT USER =====
  if (!users[sender]) {
    users[sender] = {
      step: "idle",
      lastStep: null,
      lastReplyAt: 0
    };
  }

  // ===== RATE LIMIT =====
  if (Date.now() - users[sender].lastReplyAt < RATE_LIMIT_MS) {
    return res.json({ ok:true });
  }

  // ===== APPROVE CS =====
  if (sender === CS_NUMBER && text.startsWith("#approve")) {
    const target = text.split(" ")[1];
    if (users[target]?.order) {
      await prosesDigiflazz(target);
    }
    return res.json({ ok:true });
  }

  // ===== TOLAK CS =====
  if (sender === CS_NUMBER && text.startsWith("#tolak")) {
    const target = text.split(" ")[1];
    if (users[target]) {
      await kirim(target,"Pembayaran ditolak. Silakan hubungi CS.");
      users[target] = { step:"idle", lastStep:null, lastReplyAt:0 };
    }
    return res.json({ ok:true });
  }

  // ===== TERIMA BUKTI PEMBAYARAN =====
  if (users[sender].step === "menunggu_bukti" && url) {
    await kirim(sender,"Bukti pembayaran diterima, menunggu verifikasi sistem");

    await kirim(CS_NUMBER,
`BUKTI PEMBAYARAN

Dari: ${sender}
Produk: ${users[sender].order.nama}
Tujuan: ${users[sender].order.tujuan}

Silakan cek bukti di chat ini.

#approve ${sender}
#tolak ${sender}`);

    await kirimGambar(CS_NUMBER, url, "Bukti pembayaran dari pelanggan");

    users[sender].step = "menunggu_verifikasi";
    return res.json({ ok:true });
  }

  // ===== ANTI SPAM STEP =====
  if (users[sender].lastStep === users[sender].step) {
    return res.json({ ok:true });
  }

  // ===== MENU =====
  if (["menu","halo","hai"].includes(text)) {
    users[sender] = { step: "pilih_kategori", lastStep: "menu", lastReplyAt: Date.now() };

    await kirim(sender,
`**BEMS STORE – Layanan Digital Resmi**

BEMS STORE menggunakan **sistem otomatis yang terintegrasi langsung dengan Digiflazz**, distributor resmi produk digital di Indonesia.
Harga, ketersediaan produk, dan status transaksi diproses **real-time** oleh server Digiflazz sehingga transaksi **aman, cepat, dan transparan**.

Untuk menjaga kenyamanan pelanggan, sistem bot kami dirancang **tidak membalas chat random dan tidak melakukan spam**, karena sudah menggunakan:

🔒 **Lock step** — Bot hanya merespons sesuai alur transaksi
🧠 **Satu balasan per langkah** — Menghindari pesan ganda
⏱ **Rate limit** — Membatasi pengiriman agar tidak berulang
❌ **Pesan di luar menu diabaikan** — Fokus pada transaksi aktif

Jika mengalami kendala, silakan hubungi **Customer Service (CS)** kami:
**0857-1853-9571**

Silakan pilih layanan di bawah ini:

1. Pulsa
2. Paket Data
3. PLN / Token
4. E-Money
5. Games

*Ketik angka kategori untuk melanjutkan.*`);
    return res.json({ ok:true });
  }

  // ===== PILIH KATEGORI =====
  if (users[sender].step === "pilih_kategori" && CATEGORY_MAP[text]) {
    users[sender].kategori = text;
    users[sender].step = "input_tujuan";
    users[sender].lastStep = "pilih_kategori";
    users[sender].lastReplyAt = Date.now();

    const petunjuk = {
      "1": "Masukkan Nomor HP (contoh 08xxxx) untuk Pulsa",
      "2": "Masukkan Nomor HP (contoh 08xxxx) untuk Paket Data",
      "3": "Masukkan IDPEL / Nomor Meter PLN",
      "4": "Masukkan Nomor akun E-Money",
      "5": "Masukkan ID + Server (contoh 12345678 1234)"
    }[text];

    await kirim(sender, petunjuk);
    return res.json({ ok:true });
  }

  // ===== VALIDASI TUJUAN =====
  if (users[sender].step === "input_tujuan") {
    users[sender].tujuan = text;
    users[sender].step = "pilih_produk";
    users[sender].lastStep = "input_tujuan";
    users[sender].lastReplyAt = Date.now();

    const list = await getProdukDigiflazz(users[sender].kategori);
    if (!list.length) return res.json({ ok:true });

    users[sender].produkList = list;

    await kirim(sender,
list.slice(0,20).map((p,i)=>`${i+1}. ${p.nama} - Rp${p.hargaJual}`).join("\n")
+ `\n\nKetik nomor produk`);
    return res.json({ ok:true });
  }

  // ===== PILIH PRODUK =====
  if (users[sender].step === "pilih_produk" && /^\d+$/.test(text)) {
    const p = users[sender].produkList[text-1];
    if (!p) return res.json({ ok:true });

    users[sender].order = { ...p, tujuan: users[sender].tujuan };
    users[sender].step = "menunggu_bukti";
    users[sender].lastStep = "pilih_produk";
    users[sender].lastReplyAt = Date.now();

    await kirim(sender, invoicePembeli(users[sender].order));

    if (process.env.QRIS_IMAGE_URL) {
      await new Promise(r => setTimeout(r,1500));
      await kirimGambar(sender, process.env.QRIS_IMAGE_URL, "Scan QRIS untuk bayar");
    }

    await kirim(sender,"Setelah bayar, kirim *bukti pembayaran* di chat ini.");

    await kirim(CS_NUMBER, invoiceCS(sender, users[sender].order));

    return res.json({ ok:true });
  }

  return res.json({ ok:true });
}

// ================= DIGIFLAZZ =================
async function getProdukDigiflazz(kategori, attempt = 1) {
  try {
    const brand = CATEGORY_MAP[kategori];

    const res = await fetch("https://api.digiflazz.com/v1/price-list", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        cmd:"prepaid",
        username:process.env.DIGIFLAZZ_USERNAME,
        sign:md5(process.env.DIGIFLAZZ_USERNAME + process.env.DIGIFLAZZ_KEY + "pricelist")
      })
    });

    const json = await res.json();

    return json.data
      .filter(p =>
        p.category?.toUpperCase().includes(brand) ||
        p.brand?.toUpperCase().includes(brand)
      )
      .map(p=>({
        sku:p.buyer_sku_code,
        nama:p.product_name,
        hargaModal:p.price,
        hargaJual:p.price + PROFIT
      }));

  } catch (e) {
    if (attempt < MAX_RETRY) return getProdukDigiflazz(kategori, attempt+1);
    return [];
  }
}

async function prosesDigiflazz(target, attempt = 1){
  try {
    const o = users[target].order;
    const ref = "INV"+Date.now();

    await fetch("https://api.digiflazz.com/v1/transaction",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        username:process.env.DIGIFLAZZ_USERNAME,
        buyer_sku_code:o.sku,
        customer_no:o.tujuan,
        ref_id:ref,
        sign:md5(process.env.DIGIFLAZZ_USERNAME + process.env.DIGIFLAZZ_KEY + ref)
      })
    });

    await kirim(target, strukPembeli(o, ref));
    users[target] = { step:"idle", lastStep:null, lastReplyAt:0 };

  } catch (e) {
    if (attempt < MAX_RETRY) return prosesDigiflazz(target, attempt+1);
  }
}

// ================= TEMPLATE =================
function strukPembeli(o, ref){
return `STRUK

Produk: ${o.nama}
Tujuan: ${o.tujuan}
Ref: ${ref}

Status: BERHASIL`;
}

function invoicePembeli(o){
return `INVOICE

${o.nama}
Tujuan: ${o.tujuan}

Total: Rp${o.hargaJual}

Silakan bayar via QRIS`;
}

function invoiceCS(sender,o){
return `ORDER MASUK

${sender}
${o.nama}
Tujuan: ${o.tujuan}

Modal: ${o.hargaModal}
Jual: ${o.hargaJual}

Menunggu bukti pembayaran

#approve ${sender}
#tolak ${sender}`;
}

// ================= SEND =================
async function kirim(target,message){
  await fetch("https://api.fonnte.com/send",{
    method:"POST",
    headers:{
      Authorization:process.env.FONNTE_TOKEN,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({ target,message })
  });
}

async function kirimGambar(target, url, caption){
  await fetch("https://api.fonnte.com/send",{
    method:"POST",
    headers:{
      Authorization: process.env.FONNTE_TOKEN
    },
    body: new URLSearchParams({
      target: target,
      file: url,        // WAJIB: file
      caption: caption
    })
  });
}