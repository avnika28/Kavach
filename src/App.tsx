/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db, ensureSeedData, DEFAULT_SETTINGS } from './store/db';
import { AppShell } from './components/AppShell';
import { CinematicPreloader } from './components/CinematicPreloader';
import { LandingScreen } from './screens/LandingScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ChatScreen } from './screens/ChatScreen';
import { KnowledgeBaseScreen } from './screens/KnowledgeBaseScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-welcome');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [preloaderDone, setPreloaderDone] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    ensureSeedData().then(async () => {
      const latest = await db.conversations.orderBy('updatedAt').reverse().first();
      if (mounted) {
        if (latest) {
          setActiveConversationId(latest.id);
        }
        setIsReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePreloaderComplete = useCallback(() => {
    setPreloaderDone(true);
  }, []);

  const handleNewConversation = async () => {
    const settings = (await db.settings.get('global')) || DEFAULT_SETTINGS;
    const newId = `conv-${Date.now()}`;
    await db.conversations.put({
      id: newId,
      title: 'New Sovereign Thread',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      modelId: settings.selectedModel,
    });
    setActiveConversationId(newId);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="kavach-card px-8 py-6 text-center space-y-2">
          <div className="text-2xl font-display-bebas tracking-wider">
            MOUNTING KAVACH LOCAL VAULT...
          </div>
          <p className="text-xs font-mono opacity-75">IndexedDB · Zero Cloud Telemetry</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <CinematicPreloader onComplete={handlePreloaderComplete} />
      <AppShell
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewConversation={handleNewConversation}
      >
        <Routes>
          <Route
            path="/"
            element={<LandingScreen preloaderComplete={preloaderDone} />}
          />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route
            path="/chat"
            element={<ChatScreen conversationId={activeConversationId} />}
          />
          <Route path="/knowledge" element={<KnowledgeBaseScreen />} />
          <Route path="/tools" element={<ToolsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
