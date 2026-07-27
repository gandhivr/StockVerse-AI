const express = require("express");
const router = express.Router();
const { summary, coverage, reconcile } = require("../controllers/accuracyController");

router.get("/", summary);
router.get("/coverage", coverage);
router.post("/reconcile", reconcile);

module.exports = router;
