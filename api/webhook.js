import md5 from "md5";

let users = {};

const CS_NUMBER = "6285718539571";
const PROFIT = 3000;

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

  const { sender, pesan, message } = req.body;
  const text = (pesan || message || "").toLowerCase().trim();

  if (!users[sender]) users[sender] = { step: "idle" };

  // ===== APPROVE =====
  if (sender === CS_NUMBER && text.startsWith("#approve")) {
    const target = text.split(" ")[1];
    await prosesDigiflazz(target);
    return res.json({ ok: true });
  }

  // ===== MENU UTAMA =====
  if (["menu","halo","hai"].includes(text)) {
    users[sender] = { step: "pilih_kategori" };

    await kirim(sender,
`BEMS STORE – Layanan Digital Resmi

Kami melayani pengisian Pulsa, Data, PLN, E-Money, dan Games
menggunakan sistem otomatis Digiflazz (server terpercaya & realtime).
Transaksi cepat, aman, dan transparan.

Silakan pilih layanan di bawah ini:

1. Pulsa
2. Paket Data
3. PLN / Token
4. E-Money
5. Games

Ketik angka kategori`);
    return res.json({ ok: true });
  }

  // ===== PILIH KATEGORI =====
  if (users[sender].step === "pilih_kategori") {
    users[sender].kategori = text;
    users[sender].step = "input_tujuan";

    await kirim(sender,
`Masukkan tujuan:

Pulsa/Data : Nomor HP
PLN : IDPEL / Meter
E-money : Nomor
Games : ID + Server`);
    return res.json({ ok: true });
  }

  // ===== INPUT TUJUAN =====
  if (users[sender].step === "input_tujuan") {
    users[sender].tujuan = text;
    users[sender].step = "pilih_produk";

    const list = await getProdukDigiflazz(users[sender].kategori);
    users[sender].produkList = list;

    await kirim(sender,
list.slice(0,20).map((p,i)=>`${i+1}. ${p.nama} - Rp${p.hargaJual}`).join("\n")
+ `\n\nKetik nomor produk`);
    return res.json({ ok: true });
  }

  // ===== PILIH PRODUK =====
  if (users[sender].step === "pilih_produk") {
    const p = users[sender].produkList[text-1];
    if (!p) return res.json({ ok:true });

    users[sender].order = {
      ...p,
      tujuan: users[sender].tujuan
    };

    await kirim(sender, invoicePembeli(users[sender].order));

    if (process.env.QRIS_IMAGE_URL) {
      await kirimGambar(sender, process.env.QRIS_IMAGE_URL, "Scan QRIS");
    }

    await kirim(CS_NUMBER, invoiceCS(sender, users[sender].order));

    users[sender].step = "menunggu";
    return res.json({ ok:true });
  }

  return res.json({ ok:true });
}

// ================= DIGIFLAZZ =================
async function getProdukDigiflazz(kategori) {
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
}

async function prosesDigiflazz(target){
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
  users[target]={ step:"idle" };
}

// ================= STRUK =================
function strukPembeli(o, ref){
return `STRUK PEMBAYARAN

Produk: ${o.nama}
Tujuan: ${o.tujuan}
Ref: ${ref}

Status: BERHASIL ✅
Terima kasih 🙏`;
}

function invoicePembeli(o){
return `INVOICE

${o.nama}
Tujuan: ${o.tujuan}

Total: Rp${o.hargaJual}

BCA 0750184219
DANA 085694766782
a.n ROHMAN BRAMANTO`;
}

function invoiceCS(sender,o){
return `ORDER

${sender}
${o.nama}
Tujuan: ${o.tujuan}

Modal: ${o.hargaModal}
Jual: ${o.hargaJual}

#approve ${sender}`;
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

async function kirimGambar(target,url,caption){
  await fetch("https://api.fonnte.com/send",{
    method:"POST",
    headers:{
      Authorization:process.env.FONNTE_TOKEN,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({ target,url,caption })
  });
}