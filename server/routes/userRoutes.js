import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getUserData, storeRecentSearchedCities } from "../controller/userControler.js";
const userRoutes=express.Router();
userRoutes.get('/',protect,getUserData);
userRoutes.post('/store-recent-serach',protect,storeRecentSearchedCities);

export default userRoutes;