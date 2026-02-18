import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { propertyController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/properties", requirePermission("properties.create"), asyncHandler(propertyController.createProperty))
router.post("/units", requirePermission("properties.create"), asyncHandler(propertyController.createUnit))
router.post("/listings", requirePermission("listings.create"), asyncHandler(propertyController.createListing))
router.post("/inquiries", requirePermission("inquiries.create"), asyncHandler(propertyController.createInquiry))
router.post("/deals", requirePermission("deals.create"), asyncHandler(propertyController.createDeal))
router.post("/offers", requirePermission("offers.create"), asyncHandler(propertyController.createOffer))
