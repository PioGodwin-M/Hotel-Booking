import express from "express";
import { protect } from "../middleware/authMiddleware";
import { getUserData, storeRecentSearchedCities } from "../controller/userControler";
const userRoutes=express.Router();
userRoutes.get('/',protect,getUserData);
userRoutes.post('/store-recent-serach',protect,storeRecentSearchedCities);

export default userRoutes;