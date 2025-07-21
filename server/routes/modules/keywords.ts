import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@clerk/express";
import { insertKeywordCampaignSchema } from "@shared/schema";
import { getBizForRequest, logDetailedError } from "./utils";
import { logError } from "../../utils/logger.util";

const updateKeywordCampaignSchema = insertKeywordCampaignSchema.partial();

export function registerKeywordRoutes(app: Express) {
  // Get all keyword campaigns
  app.get("/api/keyword-campaigns", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywords = await biz.getKeywordCampaigns();
      res.json(keywords);
    } catch (error) {
      logDetailedError("Error fetching keyword campaigns", error);
      res.status(500).json({ message: "Failed to fetch keyword campaigns" });
    }
  });

  // Get keyword stats
  app.get("/api/keyword-campaigns/stats", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const stats = await biz.getKeywordStats();
      res.json(stats);
    } catch (error) {
      logError("Error fetching keyword stats:", error);
      res.status(500).json({ message: "Failed to fetch keyword stats" });
    }
  });

  // Get single keyword campaign
  app.get("/api/keyword-campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid keyword campaign ID" });
      }

      const keyword = await biz.getKeywordCampaign(id);
      if (!keyword) {
        return res.status(404).json({ message: "Keyword campaign not found" });
      }
      res.json(keyword);
    } catch (error) {
      logError("Error fetching keyword campaign:", error);
      res.status(500).json({ message: "Failed to fetch keyword campaign" });
    }
  });

  // Get responses for a keyword campaign
  app.get(
    "/api/keyword-campaigns/:id/responses",
    requireAuth(),
    async (req, res) => {
      try {
        const { biz } = await getBizForRequest(req);
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res
            .status(400)
            .json({ message: "Invalid keyword campaign ID" });
        }

        const keyword = await biz.getKeywordCampaign(id);
        if (!keyword) {
          return res
            .status(404)
            .json({ message: "Keyword campaign not found" });
        }

        const responses = await biz.getKeywordResponsesForCampaign(id);
        res.json(responses);
      } catch (error) {
        logError("Error fetching keyword responses:", error);
        res.status(500).json({ message: "Failed to fetch keyword responses" });
      }
    }
  );

  // Create keyword campaign
  app.post("/api/keyword-campaigns", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const validatedData = insertKeywordCampaignSchema.parse(req.body);

      // Check if keyword already exists for this business (including deleted ones)
      const keywordExists = await biz.keywordExistsForBusiness(
        validatedData.keyword.toUpperCase()
      );
      if (keywordExists) {
        return res.status(409).json({
          message:
            "This keyword has been used before. Please delete the existing keyword to reuse it, or choose a different keyword.",
        });
      }

      // Convert keyword to uppercase for consistency and set as active by default
      const keywordData = {
        ...validatedData,
        keyword: validatedData.keyword.toUpperCase(),
        isActive: true, // Always create as active since toggle was removed
      };

      const keyword = await biz.createKeywordCampaign(keywordData);
      res.status(201).json(keyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      logDetailedError("Error creating keyword campaign", error);
      res.status(500).json({ message: "Failed to create keyword campaign" });
    }
  });

  // Update keyword campaign
  app.put("/api/keyword-campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid keyword campaign ID" });
      }

      const existingKeyword = await biz.getKeywordCampaign(id);
      if (!existingKeyword) {
        return res.status(404).json({ message: "Keyword campaign not found" });
      }

      const validatedData = updateKeywordCampaignSchema.parse(req.body);

      // If keyword is being updated, check for conflicts
      if (
        validatedData.keyword &&
        validatedData.keyword !== existingKeyword.keyword
      ) {
        const keywordExists = await biz.keywordExistsForBusiness(
          validatedData.keyword.toUpperCase()
        );
        if (keywordExists) {
          return res.status(409).json({
            message:
              "This keyword has been used before. Please delete the existing keyword to reuse it, or choose a different keyword.",
          });
        }
        // Convert keyword to uppercase for consistency
        validatedData.keyword = validatedData.keyword.toUpperCase();
      }

      const updatedKeyword = await biz.updateKeywordCampaign(id, validatedData);
      res.json(updatedKeyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      logDetailedError("Error updating keyword campaign", error);
      res.status(500).json({ message: "Failed to update keyword campaign" });
    }
  });

  // Delete keyword campaign
  app.delete("/api/keyword-campaigns/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid keyword campaign ID" });
      }

      const existingKeyword = await biz.getKeywordCampaign(id);
      if (!existingKeyword) {
        return res.status(404).json({ message: "Keyword campaign not found" });
      }

      await biz.deleteKeywordCampaign(id);
      res
        .status(200)
        .json({ message: "Keyword campaign deleted successfully" });
    } catch (error) {
      logDetailedError("Error deleting keyword campaign", error);
      res.status(500).json({ message: "Failed to delete keyword campaign" });
    }
  });
}
