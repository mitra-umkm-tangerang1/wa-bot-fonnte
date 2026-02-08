export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    console.log("Pesan masuk:", data);

    return res.status(200).json({
      status: "ok"
    });
  }

  res.status(200).send("Webhook aktif");
}