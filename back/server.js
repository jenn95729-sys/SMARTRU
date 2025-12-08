// ============================================================
// SERVER.JS UNIFICADO – SMARTQUEUE RU
// ============================================================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");
const { payload: pixPayload } = require("pix-payload");
const path = require("path");

const app = express();
const PORT = 3000;

// Mapa em memória para guardar infos extras do ticket (foto, ru, refeição...)
const ticketExtras = new Map();

// ============================================================
// CORS
// ============================================================

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

// ============================================================
// BODY PARSER (foto base64 pode ser grande)
// ============================================================

app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "5mb" }));

// ============================================================
// FRONT ESTÁTICO
// ============================================================

app.use(express.static(path.join(__dirname, "../front")));

// ============================================================
// CONFIG PIX
// ============================================================

const PIX_KEY = "+5541991159514";
const PIX_RECEIVER_NAME = "RU UFMG";
const PIX_CITY = "BELO HORIZONTE";

// ============================================================
// 1. CRIAR TICKET
// ============================================================

app.post("/api/ticket", (req, res) => {
    const { nome, categoria, preco, prioridade, ru, refeicao, fotoPerfil } = req.body;

    if (!nome || !categoria) {
        return res.status(400).json({ error: "Dados incompletos" });
    }

    const id = "TCK-" + Date.now();

    db.run(
        `INSERT INTO tickets (id, nome, categoria, preco, prioridade, pago, validado)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        [id, nome, categoria, preco || 0, prioridade || "Nenhuma"],
        err => {
            if (err) {
                console.error("Erro ao criar ticket:", err);
                return res.status(500).json({ error: "Falha ao criar ticket" });
            }

            // Guarda extras em memória para usar no /api/validar
            ticketExtras.set(id, {
                ru: ru || null,
                refeicao: refeicao || null,
                valor: preco || 0,
                fotoPerfil: fotoPerfil || null
            });

            res.json({ ticket: id });
        }
    );
});

// ============================================================
// 2. GERAR PIX
// ============================================================

app.post("/api/pix", (req, res) => {
    const { ticket } = req.body;

    if (!ticket) return res.status(400).json({ error: "Ticket não informado" });

    db.get(`SELECT * FROM tickets WHERE id = ?`, [ticket], (err, row) => {
        if (err) {
            console.error("Erro ao buscar ticket:", err);
            return res.status(500).json({ error: "Falha ao buscar ticket" });
        }
        if (!row) return res.status(404).json({ error: "Ticket não encontrado" });

        const valor = 0.01;

        let txid = ticket.replace(/[^A-Za-z0-9]/g, "");
        if (txid.length === 0) txid = "T" + Date.now();
        if (txid.length > 25) txid = txid.slice(0, 25);

        try {
            const brcode = pixPayload({
                key: PIX_KEY,
                name: PIX_RECEIVER_NAME,
                city: PIX_CITY,
                amount: valor,
                transactionId: txid
            });

            res.json({
                payload: brcode,
                valor,
                chave: PIX_KEY
            });
        } catch (e) {
            console.error("Erro ao gerar PIX:", e);
            res.status(500).json({ error: "Falha ao gerar PIX" });
        }
    });
});

// ============================================================
// 3. SIMULAR PAGAMENTO
// ============================================================

app.post("/api/simular-pago", (req, res) => {
    const { ticket } = req.body;
    if (!ticket) return res.status(400).json({ error: "Ticket não enviado" });

    db.run(
        `UPDATE tickets SET pago = 1 WHERE id = ?`,
        [ticket],
        function (err) {
            if (err) {
                console.error("Erro ao atualizar pagamento:", err);
                return res.status(500).json({ error: "Erro ao atualizar pagamento" });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: "Ticket não encontrado" });
            }
            res.json({ ok: true });
        }
    );
});

// ============================================================
// 4. STATUS DO PAGAMENTO
// ============================================================

app.get("/api/status/:ticket", (req, res) => {
    const ticket = req.params.ticket;

    db.get(
        `SELECT pago FROM tickets WHERE id = ?`,
        [ticket],
        (err, row) => {
            if (err) {
                console.error("Erro ao consultar status:", err);
                return res.status(500).json({ pago: false });
            }
            if (!row) return res.json({ pago: false });
            res.json({ pago: !!row.pago });
        }
    );
});

// ============================================================
// 5. VALIDADOR QR-CODE
// ============================================================

app.post("/api/validar", (req, res) => {
    console.log("VALIDANDO:", req.body);

    const { ticket } = req.body;
    if (!ticket) {
        return res.json({ ok: false, msg: "Ticket não enviado." });
    }

    db.get(
        `SELECT nome, categoria, pago, validado FROM tickets WHERE id = ?`,
        [ticket],
        (err, row) => {
            if (err) {
                console.error("Erro ao validar ticket:", err);
                return res.json({ ok: false, msg: "Erro no servidor." });
            }

            if (!row) {
                return res.json({ ok: false, msg: "Ticket inexistente." });
            }

            if (!row.pago) {
                return res.json({ ok: false, msg: "Pagamento pendente!" });
            }

            if (row.validado) {
                return res.json({ ok: false, msg: "QR-CODE já utilizado!" });
            }

            db.run(
                `UPDATE tickets SET validado = 1 WHERE id = ?`,
                [ticket],
                function (err2) {
                    if (err2) {
                        console.error("Erro ao marcar validado:", err2);
                        return res.json({ ok: false, msg: "Erro ao validar ticket." });
                    }

                    // recupera extras em memória (foto, refeição, ru, valor)
                    const extras = ticketExtras.get(ticket) || {};
                    const { ru, refeicao, valor, fotoPerfil } = extras;

                    return res.json({
                        ok: true,
                        msg: "Entrada liberada!",
                        nome: row.nome,
                        categoria: row.categoria,
                        ru: ru || null,
                        refeicao: refeicao || null,
                        valor: valor ?? null,
                        fotoPerfil: fotoPerfil || null
                    });
                }
            );
        }
    );
});

// ============================================================
// FRONT
// ============================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../front/index.html"));
});

// ============================================================
// START
// ============================================================

app.listen(PORT, () => {
    console.log(`SmartQueue RU rodando em http://localhost:${PORT}`);
});
