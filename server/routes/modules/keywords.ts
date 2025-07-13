import type { Express } from "express";
import { requireAuth } from "@clerk/express";
import { z } from "zod";
import {
  KeywordService,
  keywordValidationSchema,
  testMessageSchema,
} from "../../services/keywords";
import { getBizForRequest } from "./utils";
import { logError } from "../../utils/logger.util";

export function registerKeywordRoutes(app: Express) {
  // GET /api/keywords - List all keywords for business
  app.get("/api/keywords", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywords = await biz.getKeywords();
      res.json(keywords);
    } catch (error) {
      logError("Error fetching keywords:", error);
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  // POST /api/keywords - Create new keyword
  app.post("/api/keywords", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const validatedData = keywordValidationSchema.parse(req.body);

      const keyword = await KeywordService.createKeyword(
        (
          await biz.getBusiness()
        ).id,
        validatedData
      );

      res.status(201).json(keyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      if (
        error instanceof Error &&
        error.message === "Keyword already exists"
      ) {
        return res.status(409).json({ message: error.message });
      }
      logError("Error creating keyword:", error);
      res.status(500).json({ message: "Failed to create keyword" });
    }
  });

  // PUT /api/keywords/:id - Update keyword
  app.put("/api/keywords/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywordId = parseInt(req.params.id, 10);

      if (isNaN(keywordId)) {
        return res.status(400).json({ message: "Invalid keyword ID" });
      }

      const validatedData = keywordValidationSchema.partial().parse(req.body);

      const keyword = await KeywordService.updateKeyword(
        (
          await biz.getBusiness()
        ).id,
        keywordId,
        validatedData
      );

      res.json(keyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      if (error instanceof Error && error.message === "Keyword not found") {
        return res.status(404).json({ message: error.message });
      }
      if (
        error instanceof Error &&
        error.message === "Keyword already exists"
      ) {
        return res.status(409).json({ message: error.message });
      }
      logError("Error updating keyword:", error);
      res.status(500).json({ message: "Failed to update keyword" });
    }
  });

  // DELETE /api/keywords/:id - Delete keyword
  app.delete("/api/keywords/:id", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywordId = parseInt(req.params.id, 10);

      if (isNaN(keywordId)) {
        return res.status(400).json({ message: "Invalid keyword ID" });
      }

      await KeywordService.deleteKeyword(
        (
          await biz.getBusiness()
        ).id,
        keywordId
      );

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "Keyword not found") {
        return res.status(404).json({ message: error.message });
      }
      logError("Error deleting keyword:", error);
      res.status(500).json({ message: "Failed to delete keyword" });
    }
  });

  // POST /api/keywords/:id/test - Send test message
  app.post("/api/keywords/:id/test", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywordId = parseInt(req.params.id, 10);

      if (isNaN(keywordId)) {
        return res.status(400).json({ message: "Invalid keyword ID" });
      }

      const validatedData = testMessageSchema.parse(req.body);

      const result = await KeywordService.sendTestMessage(
        (
          await biz.getBusiness()
        ).id,
        keywordId,
        validatedData.phoneNumber
      );

      if (result.success) {
        res.json({
          success: true,
          messageSid: result.messageSid,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Validation error", errors: error.errors });
      }
      logError("Error sending test keyword message:", error);
      res.status(500).json({ message: "Failed to send test message" });
    }
  });

  // GET /api/keywords/:id/opt-ins - Get opt-ins for a keyword
  app.get("/api/keywords/:id/opt-ins", requireAuth(), async (req, res) => {
    try {
      const { biz } = await getBizForRequest(req);
      const keywordId = parseInt(req.params.id, 10);

      if (isNaN(keywordId)) {
        return res.status(400).json({ message: "Invalid keyword ID" });
      }

      const optIns = await biz.getKeywordOptIns(keywordId);
      res.json(optIns);
    } catch (error) {
      logError("Error fetching keyword opt-ins:", error);
      res.status(500).json({ message: "Failed to fetch keyword opt-ins" });
    }
  });
}
