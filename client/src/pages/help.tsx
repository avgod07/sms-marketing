import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle, Mail, Book, Video } from "lucide-react";

export default function Help() {
  const helpItems = [
    {
      title: "Getting Started",
      description: "Learn the basics of TextFlow and set up your first campaign",
      icon: Book,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Video Tutorials",
      description: "Watch step-by-step tutorials for common tasks",
      icon: Video,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Live Chat Support",
      description: "Get instant help from our support team",
      icon: MessageCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Email Support",
      description: "Contact our support team via email",
      icon: Mail,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  const faqs = [
    {
      question: "How do I set up Twilio integration?",
      answer: "Go to Settings > SMS Configuration and enter your Twilio Account SID, Auth Token, and phone number.",
    },
    {
      question: "What's the difference between contact segments?",
      answer: "Active Contacts have engaged recently, while Inactive contacts haven't interacted in a while.",
    },
    {
      question: "How can I import my existing contacts?",
      answer: "Use the Import button in the Contacts page to upload a CSV file with your contact information.",
    },
    {
      question: "Can I schedule campaigns for later?",
      answer: "Yes, when creating a campaign you can set a scheduled date and time for automatic sending.",
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
              Find answers and get support for TextFlow.
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {/* Help Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {helpItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={index} className="card-hover cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 ${item.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <Card>
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

        {/* Contact Support */}
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Still need help?
            </h3>
            <p className="text-gray-600 mb-6">
              Our support team is here to help you succeed with TextFlow
            </p>
            <div className="flex justify-center space-x-4">
              <Button>
                <MessageCircle className="w-4 h-4 mr-2" />
                Start Live Chat
              </Button>
              <Button variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Email Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
