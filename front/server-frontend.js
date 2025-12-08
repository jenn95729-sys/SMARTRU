const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname)));

const PORT = 8080;

app.listen(PORT, () => {
    console.log(`Frontend rodando em http://localhost:${PORT}`);
});
