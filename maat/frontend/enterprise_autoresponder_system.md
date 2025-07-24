## Frontend Dashboard & WordPress Integration

### React/Next.js Application with WordPress Communication
```javascript
// Frontend dashboard for managing the enterprise CRM system
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import { LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Dashboard = () => {
  const [contacts, setContacts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [funnels, setFunnels] = useState([])
  const [analytics, setAnalytics] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Supabase client for real-time data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  # Enterprise Autoresponder, CRM & Funnel Builder System

## System Architecture Overview

### Core Components
1. **Headless WordPress** - Content management and plugin ecosystem
2. **Supabase** - Database, authentication, and real-time subscriptions
3. **MailRelay** - Email delivery and campaign management
4. **Pipedream** - Workflow automation and API orchestration
5. **Groq API** - AI-powered content generation and analysis
6. **Frontend Application** - Custom dashboard and user interface

## WordPress Headless Configuration

### Required WordPress Plugins

#### Core CRM & Funnel Plugins
```php
// wp-config.php additions for headless setup
define('WP_REST_API_DEBUG', true);
define('HEADLESS_MODE_CLIENT_URL', 'https://your-frontend-app.com');

// Required plugins list:
- WP REST API
- Advanced Custom Fields Pro
- Custom Post Type UI
- WP Webhooks
- JWT Authentication for WP REST API
- WooCommerce (for e-commerce funnels)
- Gravity Forms (for lead capture)
- Contact Form 7
- WP User Frontend Pro
```

#### Custom WordPress Plugin Structure
```php
<?php
/*
Plugin Name: Enterprise CRM Integration
Description: Connects WordPress to Supabase, MailRelay, and Pipedream
Version: 1.0.0
*/

class EnterpriseCRMIntegration {
    
    private $api_keys_table;
    private $pipedream_webhook_url;
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('rest_api_init', array($this, 'register_api_routes'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Initialize properties
        global $wpdb;
        $this->api_keys_table = $wpdb->prefix . 'enterprise_crm_api_keys';
        $this->pipedream_webhook_url = get_option('enterprise_crm_pipedream_webhook_url');
    }
    
    public function init() {
        try {
            // Register custom post types for content management
            $this->register_post_types();
            
            // Setup webhooks for external integrations
            $this->setup_webhooks();
            
            // Initialize third-party integrations
            $this->init_integrations();
            
            // Create necessary database tables
            $this->create_tables();
            
        } catch (Exception $e) {
            error_log('Enterprise CRM Integration initialization failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Setup webhooks for Pipedream integration
     * Registers webhook endpoints and validation
     */
    private function setup_webhooks() {
        // Register webhook endpoint for receiving data from Pipedream
        add_action('wp_ajax_nopriv_enterprise_crm_webhook', array($this, 'handle_webhook'));
        add_action('wp_ajax_enterprise_crm_webhook', array($this, 'handle_webhook'));
        
        // Setup webhook validation
        add_filter('enterprise_crm_validate_webhook', array($this, 'validate_webhook_signature'), 10, 2);
    }
    
    /**
     * Initialize integrations with third-party services
     * Sets up API clients and connection testing
     */
    private function init_integrations() {
        // Initialize MailRelay API client (for initial setup/sync only)
        // Note: Pipedream handles routine email sending
        if (get_option('enterprise_crm_mailrelay_api_key')) {
            $this->mailrelay_client = new MailRelayIntegration(
                get_option('enterprise_crm_mailrelay_api_key')
            );
        }
        
        // Test Pipedream webhook connectivity on admin pages
        if (is_admin() && current_user_can('manage_options')) {
            add_action('admin_notices', array($this, 'check_integration_status'));
        }
    }
    
    /**
     * Create database tables for API key management
     */
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS {$this->api_keys_table} (
            id int(11) NOT NULL AUTO_INCREMENT,
            api_key varchar(64) NOT NULL,
            key_name varchar(100) NOT NULL,
            permissions text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            last_used datetime,
            is_active boolean DEFAULT 1,
            PRIMARY KEY (id),
            UNIQUE KEY api_key (api_key)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    private function register_post_types() {
        // Contacts/Leads (for WordPress-managed contact data)
        register_post_type('crm_contacts', array(
            'public' => true,
            'show_in_rest' => true,
            'show_in_admin_bar' => true,
            'show_in_menu' => 'enterprise-crm',
            'supports' => array('title', 'editor', 'custom-fields'),
            'labels' => array(
                'name' => 'Contacts',
                'singular_name' => 'Contact'
            )
        ));
        
        // Funnels (for funnel configuration and templates)
        register_post_type('crm_funnels', array(
            'public' => true,
            'show_in_rest' => true,
            'show_in_admin_bar' => true,
            'show_in_menu' => 'enterprise-crm',
            'supports' => array('title', 'editor', 'custom-fields'),
            'labels' => array(
                'name' => 'Funnels',
                'singular_name' => 'Funnel'
            )
        ));
        
        // Email Templates (for AI-enhanced email content)
        register_post_type('crm_email_templates', array(
            'public' => true,
            'show_in_rest' => true,
            'show_in_admin_bar' => true,
            'show_in_menu' => 'enterprise-crm',
            'supports' => array('title', 'editor', 'custom-fields'),
            'labels' => array(
                'name' => 'Email Templates',
                'singular_name' => 'Email Template'
            )
        ));
    }
    
    public function register_api_routes() {
        // Lead creation endpoint (primary entry point from forms)
        register_rest_route('enterprise-crm/v1', '/leads', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_contact'),
            'permission_callback' => array($this, 'verify_api_key'),
            'args' => array(
                'email' => array(
                    'required' => true,
                    'validate_callback' => 'is_email'
                ),
                'first_name' => array(
                    'required' => true,
                    'sanitize_callback' => 'sanitize_text_field'
                )
            )
        ));
        
        // Funnel management endpoints
        register_rest_route('enterprise-crm/v1', '/funnels/(?P<id>\d+)/trigger', array(
            'methods' => 'POST',
            'callback' => array($this, 'trigger_funnel'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Template management for frontend
        register_rest_route('enterprise-crm/v1', '/templates', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_templates'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
        
        // Analytics endpoint
        register_rest_route('enterprise-crm/v1', '/analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_analytics'),
            'permission_callback' => array($this, 'verify_api_key')
        ));
    }
    
    /**
     * API Key verification for REST API access
     * Generates and validates API keys stored in custom table
     */
    public function verify_api_key($request) {
        $api_key = $request->get_header('X-API-Key');
        
        if (!$api_key) {
            return new WP_Error('missing_api_key', 'API key required', array('status' => 401));
        }
        
        global $wpdb;
        $key_data = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->api_keys_table} WHERE api_key = %s AND is_active = 1",
            $api_key
        ));
        
        if (!$key_data) {
            return new WP_Error('invalid_api_key', 'Invalid API key', array('status' => 401));
        }
        
        // Update last used timestamp
        $wpdb->update(
            $this->api_keys_table,
            array('last_used' => current_time('mysql')),
            array('id' => $key_data->id)
        );
        
        return true;
    }
    
    /**
     * Create contact/lead with comprehensive error handling
     */
    public function create_contact($request) {
        try {
            $params = $request->get_json_params();
            
            // Validate required parameters
            if (empty($params['email']) || empty($params['first_name'])) {
                return new WP_Error(
                    'missing_required_fields', 
                    'Email and first_name are required', 
                    array('status' => 400)
                );
            }
            
            // Check for duplicate based on email
            $existing = get_posts(array(
                'post_type' => 'crm_contacts',
                'meta_query' => array(
                    array(
                        'key' => 'email',
                        'value' => $params['email'],
                        'compare' => '='
                    )
                ),
                'posts_per_page' => 1
            ));
            
            if (!empty($existing)) {
                // Update existing contact instead of creating duplicate
                $contact_id = $existing[0]->ID;
                wp_update_post(array(
                    'ID' => $contact_id,
                    'post_modified' => current_time('mysql')
                ));
            } else {
                // Create new contact in WordPress
                $contact_id = wp_insert_post(array(
                    'post_type' => 'crm_contacts',
                    'post_title' => $params['email'],
                    'post_status' => 'publish',
                    'meta_input' => array(
                        'email' => sanitize_email($params['email']),
                        'first_name' => sanitize_text_field($params['first_name']),
                        'last_name' => sanitize_text_field($params['last_name'] ?? ''),
                        'phone' => sanitize_text_field($params['phone'] ?? ''),
                        'company' => sanitize_text_field($params['company'] ?? ''),
                        'source' => sanitize_text_field($params['source'] ?? 'unknown'),
                        'tags' => $params['tags'] ?? array(),
                        'custom_fields' => $params['custom_fields'] ?? array(),
                        'created_at' => current_time('mysql'),
                        'status' => 'active'
                    )
                ));
            }
            
            if (is_wp_error($contact_id)) {
                throw new Exception('Failed to create contact: ' . $contact_id->get_error_message());
            }
            
            // Trigger Pipedream webhook for processing
            $webhook_response = $this->trigger_pipedream_webhook('lead_created', array(
                'contact_id' => $contact_id,
                'data' => $params,
                'wordpress_url' => home_url(),
                'created_at' => current_time('mysql')
            ));
            
            // Log the creation for analytics
            do_action('enterprise_crm_contact_created', $contact_id, $params);
            
            return new WP_REST_Response(array(
                'success' => true,
                'contact_id' => $contact_id,
                'message' => 'Contact created successfully',
                'webhook_triggered' => !is_wp_error($webhook_response)
            ), 201);
            
        } catch (Exception $e) {
            // Comprehensive error logging
            error_log("Enterprise CRM - Contact creation failed: " . $e->getMessage());
            error_log("Enterprise CRM - Request data: " . json_encode($params));
            
            return new WP_Error(
                'contact_creation_failed',
                'Failed to process contact: ' . $e->getMessage(),
                array('status' => 500)
            );
        }
    }
    
    /**
     * Trigger Pipedream webhook with retry logic and error handling
     */
    private function trigger_pipedream_webhook($event, $data) {
        if (empty($this->pipedream_webhook_url)) {
            error_log('Enterprise CRM: Pipedream webhook URL not configured');
            return new WP_Error('webhook_not_configured', 'Webhook URL not set');
        }
        
        $payload = array(
            'event' => $event,
            'data' => $data,
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress',
            'site_url' => home_url()
        );
        
        $response = wp_remote_post($this->pipedream_webhook_url, array(
            'body' => json_encode($payload),
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Webhook-Source' => 'enterprise-crm-wp'
            ),
            'timeout' => 30,
            'blocking' => false // Make it async to avoid blocking WordPress
        ));
        
        if (is_wp_error($response)) {
            error_log("Enterprise CRM - Webhook failed: " . $response->get_error_message());
            
            // Queue for retry using WordPress cron
            wp_schedule_single_event(time() + 300, 'enterprise_crm_retry_webhook', array($payload));
            
            return $response;
        }
        
        return $response;
    }
    
    /**
     * Generate API key for frontend/external access
     */
    public function generate_api_key($key_name, $permissions = array()) {
        global $wpdb;
        
        $api_key = wp_generate_password(64, false);
        
        $result = $wpdb->insert(
            $this->api_keys_table,
            array(
                'api_key' => $api_key,
                'key_name' => $key_name,
                'permissions' => json_encode($permissions),
                'created_at' => current_time('mysql'),
                'is_active' => 1
            )
        );
        
        if ($result === false) {
            return new WP_Error('key_generation_failed', 'Failed to generate API key');
        }
        
        return $api_key;
    }
    
    /**
     * Admin menu for CRM configuration
     */
    public function add_admin_menu() {
        add_menu_page(
            'Enterprise CRM',
            'Enterprise CRM',
            'manage_options',
            'enterprise-crm',
            array($this, 'admin_page'),
            'dashicons-groups',
            30
        );
    }
    
    public function admin_page() {
        if (isset($_POST['save_settings'])) {
            update_option('enterprise_crm_pipedream_webhook_url', sanitize_url($_POST['pipedream_webhook_url']));
            update_option('enterprise_crm_mailrelay_api_key', sanitize_text_field($_POST['mailrelay_api_key']));
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }
        
        $webhook_url = get_option('enterprise_crm_pipedream_webhook_url', '');
        $mailrelay_key = get_option('enterprise_crm_mailrelay_api_key', '');
        
        ?>
        <div class="wrap">
            <h1>Enterprise CRM Settings</h1>
            <form method="post">
                <table class="form-table">
                    <tr>
                        <th><label for="pipedream_webhook_url">Pipedream Webhook URL</label></th>
                        <td><input type="url" id="pipedream_webhook_url" name="pipedream_webhook_url" value="<?php echo esc_attr($webhook_url); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="mailrelay_api_key">MailRelay API Key</label></th>
                        <td><input type="password" id="mailrelay_api_key" name="mailrelay_api_key" value="<?php echo esc_attr($mailrelay_key); ?>" class="regular-text" /></td>
                    </tr>
                </table>
                <?php submit_button('Save Settings', 'primary', 'save_settings'); ?>
            </form>
        </div>
        <?php
    }
}

new EnterpriseCRMIntegration();
```
            
```

## Supabase Database Schema

### Database Tables
```sql
-- Users/Contacts
CREATE TABLE contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    company VARCHAR(255),
    tags TEXT[],
    custom_fields JSONB,
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Campaigns
CREATE TABLE campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    template_id UUID,
    mailrelay_campaign_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Funnels
CREATE TABLE funnels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB,
    status VARCHAR(50) DEFAULT 'active',
    conversion_tracking JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Funnel Steps
CREATE TABLE funnel_steps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    funnel_id UUID REFERENCES funnels(id),
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50), -- email, sms, delay, conditional, etc.
    configuration JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact Journey Tracking
CREATE TABLE contact_journeys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    funnel_id UUID REFERENCES funnels(id),
    current_step INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    data JSONB
);

-- Email Analytics
CREATE TABLE email_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    campaign_id UUID REFERENCES campaigns(id),
    event_type VARCHAR(50), -- sent, opened, clicked, bounced, etc.
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Interactions Log
CREATE TABLE ai_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    interaction_type VARCHAR(50), -- content_generation, analysis, etc.
    groq_request JSONB,
    groq_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Pipedream Workflows

### Pipedream Workflow: New Lead Onboarding (ID: wp-lead-processor-v1)
```javascript
// Pipedream workflow for processing new leads from WordPress
// Trigger: HTTP webhook from WordPress lead creation
export default defineComponent({
  async run({ steps, $ }) {
    try {
      // Step 1: Receive and validate webhook from WordPress
      const leadData = steps.trigger.event.body.data;
      
      // Validate required fields
      if (!leadData.email || !leadData.first_name) {
        throw new Error('Missing required fields: email and first_name');
      }
      
      console.log('Processing new lead:', leadData.email);
      
      // Step 2: Create/Update contact in Supabase with error handling
      const { data: contact, error: supabaseError } = await this.supabase
        .from('contacts')
        .upsert({
          email: leadData.email,
          first_name: leadData.first_name,
          last_name: leadData.last_name || '',
          phone: leadData.phone || '',
          source: leadData.source || 'unknown',
          tags: leadData.tags || [],
          custom_fields: leadData.custom_fields || {},
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (supabaseError) {
        throw new Error(`Supabase error: ${supabaseError.message}`);
      }
      
      // Step 3: Add to MailRelay subscriber list with error handling
      try {
        await this.mailrelay.addSubscriber({
          email: leadData.email,
          name: `${leadData.first_name} ${leadData.last_name || ''}`.trim(),
          groups: [leadData.source || 'general']
        });
      } catch (mailrelayError) {
        console.error('MailRelay subscription failed:', mailrelayError);
        // Continue processing even if MailRelay fails - log for manual review
      }
      
      // Step 4: Generate AI-powered welcome message using Groq
      const welcomeMessage = await this.groq.generateContent({
        prompt: `Create a personalized welcome email for ${leadData.first_name} who signed up from ${leadData.source}. Keep it warm, professional, and include next steps.`,
        contact_data: leadData,
        max_tokens: 500
      });
      
      // Step 5: Trigger appropriate welcome funnel sequence
      const funnelType = this.determineFunnelType(leadData.source);
      await this.triggerFunnelSequence(contact.id, funnelType);
      
      // Step 6: Log successful processing
      await this.logActivity(contact.id, 'lead_processed', {
        source: leadData.source,
        funnel_triggered: funnelType,
        timestamp: new Date().toISOString()
      });
      
      return { 
        success: true, 
        contact_id: contact.id,
        funnel_triggered: funnelType,
        message: 'Lead processed successfully'
      };
      
    } catch (error) {
      // Comprehensive error handling and logging
      console.error('Lead processing failed:', error);
      
      // Log error to monitoring system
      await this.logError('lead_processing_failed', {
        error: error.message,
        lead_data: leadData,
        timestamp: new Date().toISOString()
      });
      
      // Send alert to admin
      await this.sendAdminAlert('Lead Processing Failed', error.message, leadData);
      
      throw error;
    }
  },
  
  // Helper method to determine appropriate funnel based on lead source
  determineFunnelType(source) {
    const funnelMapping = {
      'landing_page_a': 'premium_welcome_sequence',
      'blog_signup': 'content_nurture_sequence',
      'webinar': 'webinar_followup_sequence',
      'social_media': 'social_engagement_sequence',
      'referral': 'referral_welcome_sequence'
    };
    
    return funnelMapping[source] || 'default_welcome_sequence';
  }
});
```

### Pipedream Workflow: Funnel Step Advancement (ID: funnel-automation-v1)
```javascript
// Pipedream workflow for advancing contacts through funnel steps
// Trigger: Scheduled every 5 minutes to process due funnel steps
export default defineComponent({
  async run({ steps, $ }) {
    try {
      console.log('Starting funnel step advancement process');
      
      // Get contacts ready for next step in their journey
      const { data: journeys, error: fetchError } = await this.supabase
        .from('contact_journeys')
        .select(`
          *,
          contacts(*),
          funnels(*),
          funnel_steps(*)
        `)
        .eq('status', 'active')
        .lte('next_step_at', new Date().toISOString())
        .limit(50); // Process in batches to avoid timeouts
      
      if (fetchError) {
        throw new Error(`Failed to fetch journeys: ${fetchError.message}`);
      }
      
      if (!journeys || journeys.length === 0) {
        console.log('No journeys ready for advancement');
        return { processed: 0, message: 'No journeys ready' };
      }
      
      console.log(`Processing ${journeys.length} journeys`);
      let processedCount = 0;
      let errorCount = 0;
      
      // Process each journey
      for (const journey of journeys) {
        try {
          // Find the next step in the funnel
          const nextStep = journey.funnel_steps.find(
            step => step.step_order === journey.current_step + 1
          );
          
          if (!nextStep) {
            // Journey completed - mark as finished
            await this.completeJourney(journey);
            processedCount++;
            continue;
          }
          
          // Execute the step based on its type
          await this.executeStep(journey, nextStep);
          
          // Update journey progress with next step timing
          const nextStepTime = this.calculateNextStepTime(nextStep);
          await this.supabase
            .from('contact_journeys')
            .update({
              current_step: journey.current_step + 1,
              next_step_at: nextStepTime,
              updated_at: new Date().toISOString()
            })
            .eq('id', journey.id);
          
          processedCount++;
          
        } catch (stepError) {
          console.error(`Failed to process journey ${journey.id}:`, stepError);
          errorCount++;
          
          // Log individual journey errors
          await this.logError('journey_step_failed', {
            journey_id: journey.id,
            contact_id: journey.contact_id,
            error: stepError.message,
            step: journey.current_step + 1
          });
        }
      }
      
      console.log(`Processed ${processedCount} journeys, ${errorCount} errors`);
      
      return {
        success: true,
        processed: processedCount,
        errors: errorCount,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Funnel automation workflow failed:', error);
      await this.sendAdminAlert('Funnel Automation Failed', error.message);
      throw error;
    }
  },
  
  // Execute different types of funnel steps
  async executeStep(journey, step) {
    switch (step.step_type) {
      case 'email':
        await this.executeEmailStep(journey, step);
        break;
      case 'sms':
        await this.executeSMSStep(journey, step);
        break;
      case 'delay':
        // Delay steps are handled by calculateNextStepTime
        break;
      case 'conditional':
        await this.executeConditionalStep(journey, step);
        break;
      case 'tag':
        await this.executeTagStep(journey, step);
        break;
      default:
        throw new Error(`Unknown step type: ${step.step_type}`);
    }
  },
  
  // Execute email steps with AI personalization
  async executeEmailStep(journey, step) {
    const contact = journey.contacts;
    const config = step.configuration;
    
    try {
      // Generate personalized content with Groq AI
      const emailContent = await this.groq.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email marketer. Create personalized, engaging email content that drives action.'
          },
          {
            role: 'user',
            content: `Create an email for ${contact.first_name} in funnel step ${step.step_order}. 
                     Template: ${config.template}
                     Contact data: ${JSON.stringify(contact)}
                     Journey data: ${JSON.stringify(journey.data)}
                     Keep it concise, actionable, and personalized.`
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });
      
      const generatedContent = emailContent.choices[0].message.content;
      
      // Extract subject and body (assumes AI returns structured content)
      const emailParts = this.parseEmailContent(generatedContent);
      
      // Send via MailRelay
      await this.mailrelay.sendTransactionalEmail({
        to: contact.email,
        from: config.from_email || 'noreply@yourdomain.com',
        subject: emailParts.subject || config.default_subject,
        html: emailParts.body,
        campaign_id: config.campaign_id,
        custom_fields: {
          contact_id: contact.id,
          journey_id: journey.id,
          step_id: step.id
        }
      });
      
      // Log email sent
      await this.supabase
        .from('email_analytics')
        .insert({
          contact_id: contact.id,
          campaign_id: config.campaign_id,
          event_type: 'sent',
          event_data: {
            subject: emailParts.subject,
            step_id: step.id,
            journey_id: journey.id
          }
        });
        
    } catch (error) {
      throw new Error(`Email step execution failed: ${error.message}`);
    }
  },
  
  // Calculate timing for next step based on step configuration
  calculateNextStepTime(step) {
    const now = new Date();
    const config = step.configuration;
    
    // Default delay patterns
    switch (config.delay_type) {
      case 'immediate':
        return now.toISOString();
      case 'minutes':
        return new Date(now.getTime() + (config.delay_value * 60000)).toISOString();
      case 'hours':
        return new Date(now.getTime() + (config.delay_value * 3600000)).toISOString();
      case 'days':
        return new Date(now.getTime() + (config.delay_value * 86400000)).toISOString();
      case 'business_days':
        return this.calculateBusinessDays(now, config.delay_value);
      case 'specific_time':
        return this.calculateSpecificTime(config.delay_time, config.timezone);
      default:
        // Default to 1 day if no delay specified
        return new Date(now.getTime() + 86400000).toISOString();
    }
  },
  
  // Helper to parse AI-generated email content
  parseEmailContent(content) {
    const lines = content.split('\n');
    let subject = '';
    let body = '';
    let inBody = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('subject:')) {
        subject = line.replace(/subject:\s*/i, '').trim();
      } else if (line.toLowerCase().includes('body:') || inBody) {
        if (!inBody) {
          inBody = true;
          continue;
        }
        body += line + '\n';
      }
    }
    
    return { subject: subject || 'Your Next Step', body: body.trim() || content };
  }
});
```

## MailRelay Integration

### API Configuration & Division of Labor
```php
<?php
/**
 * MailRelay Integration Class
 * Purpose: Initial setup, list management, and sync operations from WordPress
 * Note: Pipedream handles routine email sending and automation
 */
class MailRelayIntegration {
    private $api_key;
    private $api_url = 'https://api.mailrelay.com/v1/';
    
    public function __construct($api_key) {
        $this->api_key = $api_key;
    }
    
    /**
     * Create subscriber lists (used during initial setup)
     */
    public function createList($name, $description = '') {
        try {
            return $this->makeRequest('POST', 'groups', array(
                'name' => $name,
                'description' => $description,
                'public' => false
            ));
        } catch (Exception $e) {
            error_log('MailRelay createList failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Add subscriber to list (used for initial contact creation)
     * Pipedream handles ongoing subscriber management
     */
    public function addSubscriber($email, $name, $groups = array(), $custom_fields = array()) {
        try {
            $data = array(
                'email' => $email,
                'name' => $name,
                'groups' => $groups,
                'custom_fields' => $custom_fields,
                'subscribed' => true,
                'confirmed' => true // Skip double opt-in for CRM leads
            );
            
            return $this->makeRequest('POST', 'subscribers', $data);
        } catch (Exception $e) {
            error_log('MailRelay addSubscriber failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Update subscriber information
     */
    public function updateSubscriber($email, $updates) {
        try {
            return $this->makeRequest('PUT', "subscribers/{$email}", $updates);
        } catch (Exception $e) {
            error_log('MailRelay updateSubscriber failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get subscriber lists for sync purposes
     */
    public function getLists() {
        try {
            return $this->makeRequest('GET', 'groups');
        } catch (Exception $e) {
            error_log('MailRelay getLists failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Create email campaign template (setup only)
     * Actual sending handled by Pipedream
     */
    public function createCampaignTemplate($template_data) {
        try {
            return $this->makeRequest('POST', 'campaigns/templates', array(
                'name' => $template_data['name'],
                'subject' => $template_data['subject'],
                'html_content' => $template_data['html_content'],
                'text_content' => $template_data['text_content'],
                'from_email' => $template_data['from_email'],
                'from_name' => $template_data['from_name']
            ));
        } catch (Exception $e) {
            error_log('MailRelay createCampaignTemplate failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get campaign analytics (for WordPress dashboard)
     */
    public function getCampaignStats($campaign_id) {
        try {
            return $this->makeRequest('GET', "campaigns/{$campaign_id}/stats");
        } catch (Exception $e) {
            error_log('MailRelay getCampaignStats failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Test API connection
     */
    public function testConnection() {
        try {
            $response = $this->makeRequest('GET', 'account');
            return isset($response['account_id']);
        } catch (Exception $e) {
            error_log('MailRelay connection test failed: ' . $e->getMessage());
            return false;
        }
    }
    
    private function makeRequest($method, $endpoint, $data = array()) {
        $curl = curl_init();
        
        $curl_options = array(
            CURLOPT_URL => $this->api_url . $endpoint,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->api_key,
                'User-Agent: WordPress-Enterprise-CRM/1.0'
            ),
        );
        
        if (in_array($method, array('POST', 'PUT', 'PATCH')) && !empty($data)) {
            $curl_options[CURLOPT_POSTFIELDS] = json_encode($data);
        }
        
        curl_setopt_array($curl, $curl_options);
        
        $response = curl_exec($curl);
        $http_code = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        if ($error) {
            throw new Exception("cURL Error: {$error}");
        }
        
        if ($http_code >= 400) {
            throw new Exception("HTTP Error {$http_code}: {$response}");
        }
        
        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response: {$response}");
        }
        
        return $decoded;
    }
}

/**
 * WordPress integration helper for MailRelay setup
 */
class MailRelayWordPressIntegration {
    
    private $mailrelay;
    
    public function __construct() {
        $api_key = get_option('enterprise_crm_mailrelay_api_key');
        if ($api_key) {
            $this->mailrelay = new MailRelayIntegration($api_key);
        }
        
        // Setup WordPress hooks for initial sync
        add_action('enterprise_crm_contact_created', array($this, 'sync_contact_to_mailrelay'), 10, 2);
        add_action('wp_ajax_test_mailrelay_connection', array($this, 'test_connection'));
    }
    
    /**
     * Sync new WordPress contacts to MailRelay
     * Only for initial creation - updates handled by Pipedream
     */
    public function sync_contact_to_mailrelay($contact_id, $contact_data) {
        if (!$this->mailrelay) {
            error_log('MailRelay not configured for contact sync');
            return;
        }
        
        // Determine appropriate lists based on source
        $lists = $this->determine_lists($contact_data['source']);
        
        $result = $this->mailrelay->addSubscriber(
            $contact_data['email'],
            trim(($contact_data['first_name'] ?? '') . ' ' . ($contact_data['last_name'] ?? '')),
            $lists,
            array(
                'source' => $contact_data['source'],
                'wp_contact_id' => $contact_id,
                'created_date' => date('Y-m-d')
            )
        );
        
        if ($result) {
            // Store MailRelay subscriber ID for future reference
            update_post_meta($contact_id, 'mailrelay_subscriber_id', $result['id']);
        }
    }
    
    private function determine_lists($source) {
        $list_mapping = array(
            'landing_page_a' => array('premium_leads', 'all_contacts'),
            'blog_signup' => array('blog_subscribers', 'all_contacts'),
            'webinar' => array('webinar_attendees', 'all_contacts'),
            'social_media' => array('social_leads', 'all_contacts'),
            'referral' => array('referral_leads', 'all_contacts')
        );
        
        return $list_mapping[$source] ?? array('all_contacts');
    }
    
    public function test_connection() {
        if (!$this->mailrelay) {
            wp_send_json_error('MailRelay not configured');
        }
        
        $connected = $this->mailrelay->testConnection();
        
        if ($connected) {
            wp_send_json_success('MailRelay connection successful');
        } else {
            wp_send_json_error('MailRelay connection failed');
        }
    }
}

new MailRelayWordPressIntegration();
```

## Groq AI Integration

### Content Generation Service with Advanced Features
```javascript
/**
 * Groq AI service for intelligent content generation and customer analysis
 * Handles email personalization, segmentation, and content optimization
 */
class GroqAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.defaultModel = 'mixtral-8x7b-32768';
  }
  
  /**
   * Generate personalized email content based on contact data and journey stage
   */
  async generateEmailContent(prompt, contactData = {}, journeyData = {}) {
    try {
      const systemPrompt = `You are an expert email marketer and copywriter. Create personalized, engaging email content that:
      - Uses the recipient's name and relevant personal details
      - Matches their journey stage and interests
      - Includes clear call-to-actions
      - Maintains brand voice consistency
      - Drives engagement and conversions
      
      Always return emails in this JSON format:
      {
        "subject": "Email subject line",
        "body": "Full email body in HTML format",
        "preview_text": "Email preview text",
        "cta": "Primary call-to-action text",
        "personalization_used": ["list", "of", "personalization", "elements"]
      }`;
      
      const userPrompt = `${prompt}
      
      Contact Information:
      - Name: ${contactData.first_name || 'Friend'} ${contactData.last_name || ''}
      - Email: ${contactData.email}
      - Source: ${contactData.source || 'unknown'}
      - Company: ${contactData.company || 'N/A'}
      - Tags: ${JSON.stringify(contactData.tags || [])}
      - Custom Fields: ${JSON.stringify(contactData.custom_fields || {})}
      
      Journey Information:
      - Current Step: ${journeyData.current_step || 1}
      - Funnel: ${journeyData.funnel_name || 'Default'}
      - Days in Funnel: ${journeyData.days_in_funnel || 0}
      - Previous Interactions: ${JSON.stringify(journeyData.interactions || [])}
      
      Create a highly personalized email that feels human and relevant.`;
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9
      });
      
      const content = response.choices[0].message.content;
      
      // Try to parse as JSON first, fallback to text parsing
      try {
        return JSON.parse(content);
      } catch (parseError) {
        return this.parseEmailContent(content);
      }
      
    } catch (error) {
      console.error('Groq email generation failed:', error);
      throw new Error(`Email generation failed: ${error.message}`);
    }
  }
  
  /**
   * Analyze customer segments and provide marketing insights
   */
  async analyzeCustomerSegment(contacts, segmentCriteria = {}) {
    try {
      const systemPrompt = `You are a customer data analyst and marketing strategist. Analyze customer segments and provide actionable marketing insights including:
      - Segment characteristics and patterns
      - Recommended marketing strategies
      - Content preferences
      - Optimal communication frequency
      - Suggested funnel optimizations
      - Revenue opportunities
      
      Return analysis in JSON format with structured insights.`;
      
      const contactSummary = contacts.map(contact => ({
        source: contact.source,
        tags: contact.tags,
        engagement_level: contact.engagement_level,
        purchase_history: contact.purchase_history,
        journey_stage: contact.journey_stage
      }));
      
      const userPrompt = `Analyze this customer segment:
      
      Segment Criteria: ${JSON.stringify(segmentCriteria)}
      Total Contacts: ${contacts.length}
      
      Contact Data Summary:
      ${JSON.stringify(contactSummary, null, 2)}
      
      Provide detailed analysis and recommendations for this segment.`;
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });
      
      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.error('Groq segment analysis failed:', error);
      throw new Error(`Segment analysis failed: ${error.message}`);
    }
  }
  
  /**
   * Generate A/B test variations for email subjects and content
   */
  async generateABTestVariations(baseContent, testType = 'subject', variationCount = 3) {
    try {
      const systemPrompt = `You are an expert in email A/B testing and conversion optimization. Generate ${variationCount} distinct variations for ${testType} testing that:
      - Test different psychological triggers
      - Vary in tone and approach
      - Maintain message clarity
      - Are likely to produce measurable differences in performance
      
      Return variations in JSON format with explanations for each approach.`;
      
      const userPrompt = `Create ${variationCount} A/B test variations for this ${testType}:
      
      Base Content: ${JSON.stringify(baseContent)}
      
      Focus on testing: ${testType}
      
      For each variation, explain the psychological/marketing principle being tested.`;
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1200,
        temperature: 0.8
      });
      
      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.error('Groq A/B test generation failed:', error);
      throw new Error(`A/B test generation failed: ${error.message}`);
    }
  }
  
  /**
   * Optimize funnel sequences based on performance data
   */
  async optimizeFunnelSequence(funnelData, performanceMetrics) {
    try {
      const systemPrompt = `You are a funnel optimization expert. Analyze funnel performance data and recommend specific improvements to:
      - Increase conversion rates
      - Reduce drop-off points
      - Improve message sequencing
      - Optimize timing between steps
      - Enhance personalization
      
      Provide specific, actionable recommendations with expected impact estimates.`;
      
      const userPrompt = `Optimize this funnel sequence:
      
      Funnel Data:
      ${JSON.stringify(funnelData, null, 2)}
      
      Performance Metrics:
      ${JSON.stringify(performanceMetrics, null, 2)}
      
      Provide detailed optimization recommendations with priority levels.`;
      
      const response = await this.makeRequest('/chat/completions', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.4
      });
      
      return JSON.parse(response.choices[0].message.content);
      
    } catch (error) {
      console.error('Groq funnel optimization failed:', error);
      throw new Error(`Funnel optimization failed: ${error.message}`);
    }
  }
  
  /**
   * Generate dynamic content based on real-time events or triggers
   */
  async generateDynamicContent(trigger, contextData) {
    try {
      const contentTemplates = {
        cart_abandonment: 'Create urgency-driven cart abandonment email',
        milestone_celebration: 'Create celebratory milestone email',
        re_engagement: 'Create compelling re-engagement email',
        upsell_opportunity: 'Create value-focused upsell email',
        referral_request: 'Create friendly referral request email'
      };
      
      const basePrompt = contentTemplates[trigger] || 'Create engaging follow-up email';
      
      return await this.generateEmailContent(
        `${basePrompt} based on this trigger: ${trigger}`,
        contextData.contact || {},
        contextData.journey || {}
      );
      
    } catch (error) {
      console.error('Groq dynamic content generation failed:', error);
      throw new Error(`Dynamic content generation failed: ${error.message}`);
    }
  }
  
  /**
   * Make API request to Groq with error handling and retries
   */
  async makeRequest(endpoint, data, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
        
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  /**
   * Fallback text parsing when JSON parsing fails
   */
  parseEmailContent(content) {
    const lines = content.split('\n');
    let subject = '';
    let body = '';
    let inBody = false;
    let cta = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('subject:')) {
        subject = trimmed.replace(/subject:\s*/i, '').replace(/"/g, '').trim();
      } else if (trimmed.toLowerCase().includes('cta:') || trimmed.toLowerCase().includes('call to action:')) {
        cta = trimmed.replace(/(cta|call to action):\s*/i, '').replace(/"/g, '').trim();
      } else if (trimmed.toLowerCase().includes('body:') || inBody) {
        if (!inBody && trimmed.toLowerCase().includes('body:')) {
          inBody = true;
          const bodyStart = trimmed.replace(/body:\s*/i, '');
          if (bodyStart) body += bodyStart + '\n';
          continue;
        }
        if (inBody) {
          body += line + '\n';
        }
      }
    }
    
    return {
      subject: subject || 'Your Next Step',
      body: body.trim() || content,
      preview_text: subject.substring(0, 100) + '...',
      cta: cta || 'Learn More',
      personalization_used: ['basic']
    };
  }
}

// Export for use in Pipedream workflows
module.exports = GroqAIService;
```

## Frontend Dashboard

### React/Next.js Application Structure
```javascript
// Frontend dashboard for managing the system
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

const Dashboard = () => {
  const [contacts, setContacts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [funnels, setFunnels] = useState([])
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => {
    // Fetch contacts
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Fetch campaigns
    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    
    // Fetch funnels
    const { data: funnelsData } = await supabase
      .from('funnels')
      .select('*')
      .order('created_at', { ascending: false })
    
    setContacts(contactsData || [])
    setCampaigns(campaignsData || [])
    setFunnels(funnelsData || [])
  }
  
  return (
    <div className="dashboard">
      <header>
        <h1>Enterprise CRM Dashboard</h1>
      </header>
      
      <div className="stats-grid">
        <StatsCard title="Total Contacts" value={contacts.length} />
        <StatsCard title="Active Campaigns" value={campaigns.filter(c => c.status === 'active').length} />
        <StatsCard title="Running Funnels" value={funnels.filter(f => f.status === 'active').length} />
      </div>
      
      <div className="main-content">
        <ContactsSection contacts={contacts} />
        <CampaignsSection campaigns={campaigns} />
        <FunnelsSection funnels={funnels} />
      </div>
    </div>
  )
}
```

## Security & Performance Considerations

### Security Measures
1. **API Authentication**: JWT tokens for WordPress API access
2. **Rate Limiting**: Implement rate limiting on all API endpoints
3. **Data Encryption**: Encrypt sensitive data in Supabase
4. **CORS Configuration**: Properly configure CORS for headless setup
5. **Webhook Validation**: Validate webhook signatures from external services

### Performance Optimizations
1. **Caching Strategy**: Implement Redis caching for frequently accessed data
2. **Database Indexing**: Proper indexing on Supabase tables
3. **CDN Integration**: Use CDN for static assets and API responses
4. **Async Processing**: Use Pipedream for heavy processing tasks
5. **Connection Pooling**: Implement connection pooling for database connections

## Deployment & Scaling

### Infrastructure Requirements
- **WordPress Hosting**: VPS or dedicated server with headless configuration
- **Supabase**: Pro plan for production usage
- **Pipedream**: Team plan for unlimited workflows
- **Frontend Hosting**: Vercel, Netlify, or AWS CloudFront
- **CDN**: CloudFlare or AWS CloudFront
- **Monitoring**: New Relic or DataDog for system monitoring

### Environment Variables
```bash
# WordPress
WP_REST_API_KEY=your-wp-api-key
WP_WEBHOOK_SECRET=your-webhook-secret

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MailRelay
MAILRELAY_API_KEY=your-mailrelay-api-key

# Groq AI
GROQ_API_KEY=your-groq-api-key

# Pipedream
PIPEDREAM_WEBHOOK_URL=your-pipedream-webhook-url
```

This architecture provides a robust, scalable enterprise-level solution that leverages each platform's strengths while maintaining security and performance standards.