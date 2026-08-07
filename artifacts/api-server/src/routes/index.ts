import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import configRouter from "./config";
import logosRouter from "./logos";
import savedStylesRouter from "./saved-styles";
import donationRouter from "./donation";
import adsRouter from "./ads";
import channelsRouter from "./channels";
import adminRouter from "./admin";
import pricingRouter from "./pricing";
import feedbackRouter from "./feedback";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",         authRouter);
router.use("/config",       configRouter);
router.use("/logos",        logosRouter);
router.use("/saved-styles", savedStylesRouter);
router.use("/donation",     donationRouter);
router.use("/ads",          adsRouter);
router.use("/channels",     channelsRouter);
router.use("/admin",        adminRouter);
router.use("/pricing",      pricingRouter);
router.use("/feedback",     feedbackRouter);
router.use("/payments",     paymentsRouter);

export default router;
