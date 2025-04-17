import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { initHostWebRTC, setOnParticipantTrackCallback, cleanupWebRTC } from '@/utils/webrtc';
import { QRCode } from 'lucide-react';
import QRCodeComponent from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from "@/components/ui/switch"
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import { useMediaQuery } from 'usehooks-ts'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu"
import { MoreVertical } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import ParticipantGrid from '@/components/live/ParticipantGrid';
import { Copy, Edit, Share2, UserPlus, Users2 } from 'lucide-react';
import { generateRandomName } from '@/utils/name-generator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { InputEmoji } from 'react-input-emoji';
import { Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  lastActive?: number;
}

const TelaoPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newSession, setNewSession] = useState(false);
  const [sessionName, setSessionName] = useState<string>('');
  const [sessionDescription, setSessionDescription] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<Date | null>(null);
  const [sessionTime, setSessionTime] = useState<string>('');
  const [sessionCategory, setSessionCategory] = useState<string>('');
  const [sessionTags, setSessionTags] = useState<string[]>([]);
  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public');
  const [sessionPrice, setSessionPrice] = useState<number>(0);
  const [sessionCurrency, setSessionCurrency] = useState<string>('BRL');
  const [sessionLanguage, setSessionLanguage] = useState<string>('pt-BR');
  const [sessionLocation, setSessionLocation] = useState<string>('');
  const [sessionMaxParticipants, setSessionMaxParticipants] = useState<number>(100);
  const [sessionAgeRestriction, setSessionAgeRestriction] = useState<number>(0);
  const [sessionRecordingEnabled, setSessionRecordingEnabled] = useState<boolean>(false);
  const [sessionChatEnabled, setSessionChatEnabled] = useState<boolean>(true);
  const [sessionQnaEnabled, setSessionQnaEnabled] = useState<boolean>(true);
  const [sessionPollsEnabled, setSessionPollsEnabled] = useState<boolean>(true);
  const [sessionReactionsEnabled, setSessionReactionsEnabled] = useState<boolean>(true);
  const [sessionFilesEnabled, setSessionFilesEnabled] = useState<boolean>(true);
  const [sessionWhiteboardEnabled, setSessionWhiteboardEnabled] = useState<boolean>(true);
  const [sessionLayout, setSessionLayout] = useState<'grid' | 'spotlight' | 'cinema'>('grid');
  const [sessionTheme, setSessionTheme] = useState<'light' | 'dark'>('light');
  const [sessionWatermark, setSessionWatermark] = useState<string>('');
  const [sessionLogo, setSessionLogo] = useState<string>('');
  const [sessionCustomCss, setSessionCustomCss] = useState<string>('');
  const [sessionCustomJs, setSessionCustomJs] = useState<string>('');
  const [sessionAnalyticsEnabled, setSessionAnalyticsEnabled] = useState<boolean>(false);
  const [sessionAnalyticsId, setSessionAnalyticsId] = useState<string>('');
	const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; message: string; timestamp: Date }[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showQna, setShowQna] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showWatermarkSettings, setShowWatermarkSettings] = useState(false);
  const [showLogoSettings, setShowLogoSettings] = useState(false);
  const [showCustomCssSettings, setShowCustomCssSettings] = useState(false);
  const [showCustomJsSettings, setShowCustomJsSettings] = useState(false);
  const [showAnalyticsSettings, setShowAnalyticsSettings] = useState(false);
  const [showAnalyticsIdSettings, setShowAnalyticsIdSettings] = useState(false);
  const [showSessionNameSettings, setShowSessionNameSettings] = useState(false);
  const [showSessionDescriptionSettings, setShowSessionDescriptionSettings] = useState(false);
  const [showSessionDateSettings, setShowSessionDateSettings] = useState(false);
  const [showSessionTimeSettings, setShowSessionTimeSettings] = useState(false);
  const [showSessionCategorySettings, setShowSessionCategorySettings] = useState(false);
  const [showSessionTagsSettings, setShowSessionTagsSettings] = useState(false);
  const [showSessionVisibilitySettings, setShowSessionVisibilitySettings] = useState(false);
  const [showSessionPriceSettings, setShowSessionPriceSettings] = useState(false);
  const [showSessionCurrencySettings, setShowSessionCurrencySettings] = useState(false);
  const [showSessionLanguageSettings, setShowSessionLanguageSettings] = useState(false);
  const [showSessionLocationSettings, setShowSessionLocationSettings] = useState(false);
  const [showSessionMaxParticipantsSettings, setShowSessionMaxParticipantsSettings] = useState(false);
  const [showSessionAgeRestrictionSettings, setShowSessionAgeRestrictionSettings] = useState(false);
  const [showSessionRecordingEnabledSettings, setShowSessionRecordingEnabledSettings] = useState(false);
  const [showSessionChatEnabledSettings, setShowSessionChatEnabledSettings] = useState(false);
  const [showSessionQnaEnabledSettings, setShowSessionQnaEnabledSettings] = useState(false);
  const [showSessionPollsEnabledSettings, setShowSessionPollsEnabledSettings] = useState(false);
  const [showSessionReactionsEnabledSettings, setShowSessionReactionsEnabledSettings] = useState(false);
  const [showSessionFilesEnabledSettings, setShowSessionFilesEnabledSettings] = useState(false);
  const [showSessionWhiteboardEnabledSettings, setShowSessionWhiteboardEnabledSettings] = useState(false);
  const [isSmallScreen] = useMediaQuery('(max-width: 768px)')
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSessionOwner, setIsSessionOwner] = useState(false);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<Date | null>(null);
  const [sessionUpdatedAt, setSessionUpdatedAt] = useState<Date | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [sessionEndedAt, setSessionEndedAt] = useState<Date | null>(null);
  const [sessionViews, setSessionViews] = useState<number>(0);
  const [sessionLikes, setSessionLikes] = useState<number>(0);
  const [sessionShares, setSessionShares] = useState<number>(0);
  const [sessionComments, setSessionComments] = useState<number>(0);
  const [sessionDownloads, setSessionDownloads] = useState<number>(0);
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [sessionRatingCount, setSessionRatingCount] = useState<number>(0);
  const [sessionRevenue, setSessionRevenue] = useState<number>(0);
  const [sessionRevenueCurrency, setSessionRevenueCurrency] = useState<string>('BRL');
  const [sessionParticipantsCount, setSessionParticipantsCount] = useState<number>(0);
  const [sessionMessagesCount, setSessionMessagesCount] = useState<number>(0);
  const [sessionQuestionsCount, setSessionQuestionsCount] = useState<number>(0);
  const [sessionPollsCount, setSessionPollsCount] = useState<number>(0);
  const [sessionFilesCount, setSessionFilesCount] = useState<number>(0);
  const [sessionReactionsCount, setSessionReactionsCount] = useState<number>(0);
  const [sessionWhiteboardCount, setSessionWhiteboardCount] = useState<number>(0);
  const [sessionCustomData, setSessionCustomData] = useState<any>(null);
  const [sessionCustomDataSchema, setSessionCustomDataSchema] = useState<any>(null);
  const [sessionCustomDataUiSchema, setSessionCustomDataUiSchema] = useState<any>(null);
  const [sessionCustomDataForm, setSessionCustomDataForm] = useState<any>(null);
  const [sessionCustomDataFormSchema, setSessionCustomDataFormSchema] = useState<any>(null);
  const [sessionCustomDataFormUiSchema, setSessionCustomDataFormUiSchema] = useState<any>(null);
  const [sessionCustomDataFormValue, setSessionCustomDataFormValue] = useState<any>(null);
  const [sessionCustomDataFormError, setSessionCustomDataFormError] = useState<any>(null);
  const [sessionCustomDataFormTouched, setSessionCustomDataFormTouched] = useState<any>(null);
  const [sessionCustomDataFormValid, setSessionCustomDataFormValid] = useState<boolean>(false);
  const [sessionCustomDataFormDirty, setSessionCustomDataFormDirty] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitting, setSessionCustomDataFormSubmitting] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitted, setSessionCustomDataFormSubmitted] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitError, setSessionCustomDataFormSubmitError] = useState<any>(null);
  const [sessionCustomDataFormSubmitSuccess, setSessionCustomDataFormSubmitSuccess] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitLoading, setSessionCustomDataFormSubmitLoading] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitButtonText, setSessionCustomDataFormSubmitButtonText] = useState<string>('Salvar');
  const [sessionCustomDataFormCancelButtonText, setSessionCustomDataFormCancelButtonText] = useState<string>('Cancelar');
  const [sessionCustomDataFormSubmitButtonIcon, setSessionCustomDataFormSubmitButtonIcon] = useState<any>(null);
  const [sessionCustomDataFormCancelButtonIcon, setSessionCustomDataFormCancelButtonIcon] = useState<any>(null);
  const [sessionCustomDataFormSubmitButtonClassName, setSessionCustomDataFormSubmitButtonClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonClassName, setSessionCustomDataFormCancelButtonClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonDisabled, setSessionCustomDataFormSubmitButtonDisabled] = useState<boolean>(false);
  const [sessionCustomDataFormCancelButtonDisabled, setSessionCustomDataFormCancelButtonDisabled] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitButtonLoading, setSessionCustomDataFormSubmitButtonLoading] = useState<boolean>(false);
  const [sessionCustomDataFormCancelButtonLoading, setSessionCustomDataFormCancelButtonLoading] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitButtonLoadingIcon, setSessionCustomDataFormSubmitButtonLoadingIcon] = useState<any>(null);
  const [sessionCustomDataFormCancelButtonLoadingIcon, setSessionCustomDataFormCancelButtonLoadingIcon] = useState<any>(null);
  const [sessionCustomDataFormSubmitButtonLoadingText, setSessionCustomDataFormSubmitButtonLoadingText] = useState<string>('Salvando...');
  const [sessionCustomDataFormCancelButtonLoadingText, setSessionCustomDataFormCancelButtonLoadingText] = useState<string>('Cancelando...');
  const [sessionCustomDataFormSubmitButtonLoadingClassName, setSessionCustomDataFormSubmitButtonLoadingClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingClassName, setSessionCustomDataFormCancelButtonLoadingClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingDisabled, setSessionCustomDataFormSubmitButtonLoadingDisabled] = useState<boolean>(false);
  const [sessionCustomDataFormCancelButtonLoadingDisabled, setSessionCustomDataFormCancelButtonLoadingDisabled] = useState<boolean>(false);
  const [sessionCustomDataFormSubmitButtonLoadingIconClassName, setSessionCustomDataFormSubmitButtonLoadingIconClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconClassName, setSessionCustomDataFormCancelButtonLoadingIconClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpin, setSessionCustomDataFormSubmitButtonLoadingIconSpin] = useState<boolean>(true);
  const [sessionCustomDataFormCancelButtonLoadingIconSpin, setSessionCustomDataFormCancelButtonLoadingIconSpin] = useState<boolean>(true);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinDuration, setSessionCustomDataFormSubmitButtonLoadingIconSpinDuration] = useState<number>(1000);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinDuration, setSessionCustomDataFormCancelButtonLoadingIconSpinDuration] = useState<number>(1000);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinEasing, setSessionCustomDataFormSubmitButtonLoadingIconSpinEasing] = useState<string>('linear');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinEasing, setSessionCustomDataFormCancelButtonLoadingIconSpinEasing] = useState<string>('linear');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinIterations, setSessionCustomDataFormSubmitButtonLoadingIconSpinIterations] = useState<number>(0);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinIterations, setSessionCustomDataFormCancelButtonLoadingIconSpinIterations] = useState<number>(0);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinDirection, setSessionCustomDataFormSubmitButtonLoadingIconSpinDirection] = useState<string>('normal');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinDirection, setSessionCustomDataFormCancelButtonLoadingIconSpinDirection] = useState<string>('normal');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinFillMode, setSessionCustomDataFormSubmitButtonLoadingIconSpinFillMode] = useState<string>('forwards');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinFillMode, setSessionCustomDataFormCancelButtonLoadingIconSpinFillMode] = useState<string>('forwards');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinDelay, setSessionCustomDataFormSubmitButtonLoadingIconSpinDelay] = useState<number>(0);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinDelay, setSessionCustomDataFormCancelButtonLoadingIconSpinDelay] = useState<number>(0);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimation, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimation] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimation, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimation] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDuration, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDuration] = useState<number>(1000);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDuration, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDuration] = useState<number>(1000);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationEasing, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationEasing] = useState<string>('linear');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationEasing, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationEasing] = useState<string>('linear');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterations, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterations] = useState<number>(0);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterations, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterations] = useState<number>(0);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDirection, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDirection] = useState<string>('normal');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDirection, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDirection] = useState<string>('normal');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationFillMode, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationFillMode] = useState<string>('forwards');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationFillMode, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationFillMode] = useState<string>('forwards');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelay, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelay] = useState<number>(0);
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelay, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelay] = useState<number>(0);
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationEasingClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationEasingClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationEasingClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationEasingClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDirectionClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDirectionClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDirectionClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDirectionClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationFillModeClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationFillModeClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationFillModeClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationFillModeClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnit] = useState<string>('ms');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnit] = useState<string>('ms');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnit] = useState<string>('times');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnit] = useState<string>('times');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnit] = useState<string>('ms');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnit] = useState<string>('ms');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassName, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassName, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassName] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationIterationsClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit, setSessionCustomDataFormCancelButtonLoadingIconSpinAnimationDelayClassNameUnitClassNameUnitUnitUnitUnitUnitUnitUnitUnit] = useState<string>('');
  const [sessionCustomDataFormSubmitButtonLoadingIconSpinAnimationDurationClassNameUnitClassNameUnit
