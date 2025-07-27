import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">SMS/Text Messaging Privacy</h2>
              <p className="text-gray-700 mb-4">
                When you provide your mobile phone number and consent to receive text messages from us, we collect and use your information as follows:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Your mobile phone number is used solely for sending you text messages you've requested</li>
                <li>Message frequency varies based on the services you've subscribed to</li>
                <li>Standard message and data rates may apply from your carrier</li>
                <li>We use automatic telephone dialing systems to send messages</li>
                <li>You can opt out at any time by replying STOP to any message</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Information We Collect</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Contact information (name, phone number, email address)</li>
                <li>Message history and delivery status</li>
                <li>Consent records and timestamps</li>
                <li>Device and technical information for message delivery</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>To send you requested text messages and notifications</li>
                <li>To respond to your customer service inquiries</li>
                <li>To comply with legal and regulatory requirements</li>
                <li>To improve our messaging services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Sharing</h2>
              <p className="text-gray-700 mb-4">
                We do not sell, rent, or share your personal information with third parties except:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>With service providers who help us deliver messages (like Twilio)</li>
                <li>When required by law or to protect our rights</li>
                <li>With your explicit consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Right to opt out of text messages at any time (reply STOP)</li>
                <li>Right to access your personal information</li>
                <li>Right to request deletion of your data</li>
                <li>Right to update or correct your information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
              <p className="text-gray-700">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
              <p className="text-gray-700">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Reply HELP to any text message</li>
                <li>Email: getnotiflow@gmail.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by sending you a text message or posting a notice on our website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 