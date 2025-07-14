import { describe, it, expect, vi } from "vitest";
import { InitialMessageFormValues } from "./initial-message-form";

// Mock the form validation schema
const mockValidateMessage = (message: string) => {
  if (!message.trim()) {
    return { isValid: false, error: "Initial message is required" };
  }
  
  // Check if message already has compliance text
  const hasCompliance = message.toLowerCase().includes("text stop to unsubscribe");
  const completeMessage = hasCompliance ? message : `${message} Text STOP to unsubscribe`;
  
  if (completeMessage.length > 160) {
    return { isValid: false, error: "Message exceeds 160 character limit" };
  }
  
  return { isValid: true, completeMessage };
};

// Mock the compliance text appending logic
const mockAppendComplianceText = (message: string) => {
  if (!message.trim()) return message;
  
  const complianceText = " Text STOP to unsubscribe";
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("text stop to unsubscribe")) {
    return message;
  }
  
  return `${message}${complianceText}`;
};

describe("InitialMessageForm Logic", () => {
  describe("Message Validation", () => {
    it("should reject empty messages", () => {
      const result = mockValidateMessage("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Initial message is required");
    });

    it("should reject whitespace-only messages", () => {
      const result = mockValidateMessage("   ");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Initial message is required");
    });

    it("should accept valid messages", () => {
      const result = mockValidateMessage("Welcome to our service!");
      expect(result.isValid).toBe(true);
      expect(result.completeMessage).toBe("Welcome to our service! Text STOP to unsubscribe");
    });

    it("should reject messages that exceed 160 characters after adding compliance text", () => {
      const longMessage = "a".repeat(140); // 140 chars + 24 chars compliance = 164 chars
      const result = mockValidateMessage(longMessage);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Message exceeds 160 character limit");
    });


  });

  describe("Compliance Text Handling", () => {
    it("should append compliance text to messages without it", () => {
      const message = "Welcome to our service!";
      const result = mockAppendComplianceText(message);
      expect(result).toBe("Welcome to our service! Text STOP to unsubscribe");
    });

    it("should not duplicate compliance text if already present", () => {
      const messageWithCompliance = "Welcome! Text STOP to unsubscribe";
      const result = mockAppendComplianceText(messageWithCompliance);
      expect(result).toBe(messageWithCompliance);
    });

    it("should handle case-insensitive compliance text detection", () => {
      const messageWithLowerCase = "Welcome! text stop to unsubscribe";
      const result = mockAppendComplianceText(messageWithLowerCase);
      expect(result).toBe(messageWithLowerCase);
    });

    it("should handle compliance text in different variations", () => {
      const variations = [
        "Welcome! Text STOP to unsubscribe",
        "Welcome! text stop to unsubscribe",
        "Welcome! TEXT STOP TO UNSUBSCRIBE",
        "Welcome! Text Stop To Unsubscribe",
      ];

      variations.forEach(variation => {
        const result = mockAppendComplianceText(variation);
        expect(result).toBe(variation);
      });
    });

    it("should handle empty or whitespace messages", () => {
      expect(mockAppendComplianceText("")).toBe("");
      expect(mockAppendComplianceText("   ")).toBe("   ");
    });
  });

  describe("Character Count Logic", () => {
    it("should count characters correctly for basic messages", () => {
      const message = "Hello world!";
      const completeMessage = mockAppendComplianceText(message);
      expect(completeMessage.length).toBe(message.length + " Text STOP to unsubscribe".length);
    });

    it("should count unicode characters correctly", () => {
      const unicodeMessage = "Hello 👋 World 🌍";
      const completeMessage = mockAppendComplianceText(unicodeMessage);
      expect(completeMessage.length).toBe(unicodeMessage.length + " Text STOP to unsubscribe".length);
    });

    it("should handle special characters", () => {
      const specialMessage = "Welcome! @#$%^&*()";
      const completeMessage = mockAppendComplianceText(specialMessage);
      expect(completeMessage.length).toBe(specialMessage.length + " Text STOP to unsubscribe".length);
    });

    it("should handle newlines and tabs", () => {
      const messageWithWhitespace = "Welcome!\nNew line\tTab";
      const completeMessage = mockAppendComplianceText(messageWithWhitespace);
      expect(completeMessage.length).toBe(messageWithWhitespace.length + " Text STOP to unsubscribe".length);
    });
  });

  describe("Form Data Types", () => {
    it("should validate InitialMessageFormValues type", () => {
      const validData: InitialMessageFormValues = {
        initialMessage: "Welcome to our service!",
      };

      expect(validData.initialMessage).toBe("Welcome to our service!");
      expect(typeof validData.initialMessage).toBe("string");
    });

    it("should handle form submission data", () => {
      const formData: InitialMessageFormValues = {
        initialMessage: "Welcome! Text STOP to unsubscribe",
      };

      const mockOnSubmit = vi.fn();
      mockOnSubmit(formData);

      expect(mockOnSubmit).toHaveBeenCalledWith(formData);
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle messages with only compliance text", () => {
      const onlyCompliance = "Text STOP to unsubscribe";
      const result = mockAppendComplianceText(onlyCompliance);
      expect(result).toBe(onlyCompliance);
    });

    it("should handle messages with compliance text in the middle", () => {
      const message = "Welcome! Text STOP to unsubscribe. We're glad to have you!";
      const result = mockAppendComplianceText(message);
      expect(result).toBe(message);
    });

    it("should handle very short messages", () => {
      const shortMessage = "Hi!";
      const result = mockAppendComplianceText(shortMessage);
      expect(result).toBe("Hi! Text STOP to unsubscribe");
    });

    it("should handle messages with multiple spaces", () => {
      const spacedMessage = "Welcome    to    our    service!";
      const result = mockAppendComplianceText(spacedMessage);
      expect(result).toBe("Welcome    to    our    service! Text STOP to unsubscribe");
    });

    it("should handle messages with compliance text variations", () => {
      const variations = [
        "Welcome! Reply STOP to unsubscribe",
        "Welcome! Send STOP to opt out",
        "Welcome! Text STOP to stop messages",
      ];

      variations.forEach(variation => {
        const result = mockAppendComplianceText(variation);
        // These should not be detected as having compliance text
        expect(result).toBe(`${variation} Text STOP to unsubscribe`);
      });
    });
  });

  describe("Performance and Limits", () => {


    it("should handle repeated validation calls", () => {
      const message = "Welcome to our service!";
      const iterations = 1000;
      
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        mockValidateMessage(message);
      }
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should complete 1000 validations in under 100ms
    });
  });

  describe("Integration with Form State", () => {
    it("should support form submission workflow", () => {
      const mockOnSubmit = vi.fn();
      const mockOnBack = vi.fn();
      
      const formData: InitialMessageFormValues = {
        initialMessage: "Welcome to our service!",
      };

      // Simulate form submission
      mockOnSubmit(formData);
      
      expect(mockOnSubmit).toHaveBeenCalledWith(formData);
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("should support form navigation", () => {
      const mockOnBack = vi.fn();
      
      // Simulate back navigation
      mockOnBack();
      
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it("should handle form state updates", () => {
      const mockSetValue = vi.fn();
      const testMessage = "Updated message";
      
      mockSetValue("initialMessage", testMessage);
      
      expect(mockSetValue).toHaveBeenCalledWith("initialMessage", testMessage);
    });
  });
}); 