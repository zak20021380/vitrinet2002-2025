const express = require('express');
const router = express.Router();
const missionSettingsController = require('../controllers/missionSettingsController');
const userMissionController = require('../controllers/userMissionController');
const auth = require('../middlewares/authMiddleware');

// Admin routes (should be protected with admin auth middleware)
router.get('/admin/missions', missionSettingsController.getAllMissions);
router.put('/admin/missions/:missionId', missionSettingsController.updateMission);
router.post('/admin/missions/bulk-update', missionSettingsController.bulkUpdateMissions);
router.post('/admin/missions/reset', missionSettingsController.resetToDefaults);

// Public routes for fetching active missions
router.get('/missions/users', missionSettingsController.getActiveMissionsForUsers);
router.get('/missions/product-sellers', missionSettingsController.getActiveMissionsForProductSellers);
router.get('/missions/service-sellers', missionSettingsController.getActiveMissionsForServiceSellers);

// User mission progress routes (protected)
router.post('/missions/track-visit', auth('user'), userMissionController.trackStoreVisit);
router.get('/missions/browse-status', auth('user'), userMissionController.getBrowseMissionStatus);
router.post('/missions/browse-reset', auth('user'), userMissionController.resetBrowseMission);

module.exports = router;
