import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfServicePage() {
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">SMS/Text Messaging Terms</h2>
              <p className="text-gray-700 mb-4">
                By providing your mobile phone number and consenting to receive text messages, you agree to the following terms:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>You consent to receive text messages sent via automatic telephone dialing system</li>
                <li>Message frequency varies based on your subscriptions and business communications</li>
                <li>Standard message and data rates from your wireless carrier may apply</li>
                <li>Consent to receive messages is not required to make purchases or use services</li>
                <li>You may opt out at any time by replying STOP to any message</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">TCPA Compliance</h2>
              <p className="text-gray-700 mb-4">
                We comply with the Telephone Consumer Protection Act (TCPA) and related regulations:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>All promotional messages require your express written consent</li>
                <li>Messages are only sent during appropriate hours (8 AM - 9 PM local time)</li>
                <li>We maintain records of your consent and opt-out requests</li>
                <li>STOP requests are processed immediately and honored permanently</li>
                <li>HELP requests receive prompt customer service responses</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Message Types</h2>
              <p className="text-gray-700 mb-4">You may receive the following types of messages:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Transactional:</strong> Order confirmations, appointment reminders, account notifications</li>
                <li><strong>Promotional:</strong> Marketing offers, sales announcements, special deals (requires express written consent)</li>
                <li><strong>Service:</strong> System updates, security alerts, customer service responses</li>
                <li><strong>Emergency:</strong> Urgent safety or security notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Provide accurate and current mobile phone number</li>
                <li>Notify us of any changes to your phone number</li>
                <li>Ensure you have authority to consent for the provided number</li>
                <li>Review and understand message frequency and content expectations</li>
                <li>Report any issues or concerns promptly</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Opt-Out Instructions</h2>
              <p className="text-gray-700 mb-4">You have several ways to opt out of text messages:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Reply <strong>STOP</strong> to any text message</li>
                <li>Reply <strong>UNSUBSCRIBE</strong> to any text message</li>
                <li>Contact customer service directly</li>
                <li>Manage preferences in your account settings</li>
              </ul>
              <p className="text-gray-700 mt-4">
                After opting out, you will receive one confirmation message, then no further messages 
                except as required by law or for emergency notifications.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Help and Support</h2>
              <p className="text-gray-700 mb-4">For assistance with text messages:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Reply <strong>HELP</strong> to any text message</li>
                <li>Email: getnotiflow@gmail.com</li>
                <li>Visit our help center online</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitations and Disclaimers</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Message delivery is subject to carrier limitations and may be delayed</li>
                <li>We are not responsible for carrier charges or data usage</li>
                <li>Service availability may vary by location and carrier</li>
                <li>Emergency services: Do not rely on SMS for emergency communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to Terms</h2>
              <p className="text-gray-700">
                We may update these terms from time to time. Material changes will be communicated 
                through text message or other appropriate means. Continued use of our SMS service 
                after changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Information</h2>
              <p className="text-gray-700 mb-4">
                For questions about these Terms of Service:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Email: getnotiflow@gmail.com</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 