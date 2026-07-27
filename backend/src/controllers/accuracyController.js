const {
  getAccuracySummary,
  getModelCoverage,
  getTrainingSummary,
  reconcileDuePredictions,
} = require("../services/predictionTrackingService");

exports.summary = async (req, res, next) => {
  try {
    const [accuracy, coverage] = await Promise.all([getAccuracySummary(), getModelCoverage()]);
    res.json({
      success: true,
      data: {
        accuracy,
        coverage,
        trainingSummary: getTrainingSummary(),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.coverage = async (req, res, next) => {
  try {
    res.json({ success: true, data: getModelCoverage() });
  } catch (error) {
    next(error);
  }
};

exports.reconcile = async (req, res, next) => {
  try {
    const data = await reconcileDuePredictions();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
