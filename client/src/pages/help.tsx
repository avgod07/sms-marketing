import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Mail } from "lucide-react";

export default function Help() {
  const faqs = [
    {
      question: "How do I complete the onboarding process?",
      answer:
        "The onboarding process includes 5 steps: Business Information, Twilio Setup, SMS Use Cases, Toll-Free Number selection, and setting your Welcome Message. You'll need to complete all steps before you can send campaigns or add contacts.",
    },
    {
      question: "How do I add contacts to my list?",
      answer:
        "You can add contacts individually through the Contacts page by clicking 'Add Contact'. Each new contact will automatically receive your welcome message.",
    },
    {
      question: "What's the difference between SMS and MMS?",
      answer:
        "SMS is text-only and costs 1 credit per message. MMS includes images and costs 3 credits per message. You can attach images up to 5MB in JPG, PNG, or GIF format.",
    },
    {
      question: "How does the credit system work?",
      answer:
        "Credits are used to send messages. SMS costs 1 credit, MMS costs 3 credits. You can purchase credits in your Settings under the Billing tab. Minimum purchase is 50 credits.",
    },
    {
      question: "What's included in the Starter Plan?",
      answer:
        "The Starter Plan ($20/month or $180/year) includes unlimited SMS campaigns, contact management, coupons, direct messaging, basic analytics, and priority support.",
    },
    {
      question: "Can I send a test message before launching a campaign?",
      answer:
        "Yes! When creating a campaign, you can use the 'Send Test' button to send a test message to any phone number. This helps you preview how your message will look.",
    },
    {
      question: "How do I create and manage coupons?",
      answer:
        "Go to the Coupons page to create discount codes. You can set percentage or fixed amount discounts, expiration dates, and usage limits. Include coupon codes in your campaign messages for customers to redeem.",
    },
    {
      question: "What happens during my free trial?",
      answer:
        "Your free trial includes full access to all features. You'll need to upgrade to a paid plan to continue sending messages and creating campaigns after your trial expires.",
    },
    {
      question: "How do I send messages to individual contacts?",
      answer:
        "You can send direct messages through the Inbox page or by clicking the 'Message' button next to any contact in your contact list. This opens a direct conversation with that contact.",
    },
    {
      question: "Can I duplicate existing campaigns?",
      answer:
        "Yes! In your Campaigns list, click the three dots menu next to any campaign and select 'Duplicate'. This creates a draft copy of the campaign with the same message that you can modify and send separately.",
    },
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
            <p className="text-gray-600 mt-1">
              Find answers and get support for NotiFlow.
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {/* FAQ Section - Now first */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HelpCircle className="w-5 h-5" />
              <span>Frequently Asked Questions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support Section - Now at bottom */}
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Need help? We're here for you!
            </h3>
            <p className="text-gray-600 mb-4">
              Our support team typically responds within an hour
            </p>
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">getnotiflow@gmail.com</p>
              <p className="text-sm text-gray-500">Response time: Under 1 hour</p>
            </div>
            <Button className="mt-4" asChild>
              <a href="mailto:getnotiflow@gmail.com">
                <Mail className="w-4 h-4 mr-2" />
                Email Support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
