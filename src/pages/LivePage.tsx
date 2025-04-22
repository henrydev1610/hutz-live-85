import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { 
  Copy, 
  Check, 
  X, 
  Plus, 
  Trash, 
  Download, 
  Loader2, 
  AlertTriangle,
  Tv2,
  Settings,
  Share2,
  Eye,
  EyeOff
} from "lucide-react";
import { 
  createSession, 
  getSession, 
  endSession, 
  updateSession,
  updateSessionParticipant,
  getSessionFinalAction,
  deleteSessionFinalAction
} from '@/utils/sessionUtils';
import { generateRandomId } from '@/utils/utils';
import ParticipantGrid from "@/components/live/ParticipantGrid";
import LivePreview from "@/components/live/LivePreview";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CirclePicker } from 'react-color';
import { useTheme } from "@/components/ui/use-theme"
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
import { requestParticipantStream } from '@/utils/participantStreamUtils';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

const LivePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeVisible, setQrCodeVisible] = useState(true);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [qrCodePosition, setQrCodePosition] = useState({ x: 20, y: 20, width: 120, height: 120 });
  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({ x: 20, y: 160, width: 120, height: 40 });
  const [qrCodeDescription, setQrCodeDescription] = useState('Acesse com o QR Code');
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [selectedTextColor, setSelectedTextColor] = useState('#ffffff');
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(14);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState('#000000');
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isLivePreviewVisible, setIsLivePreviewVisible] = useState(true);
  const [finalAction, setFinalAction] = useState<{
    type: 'none' | 'image' | 'coupon';
    image?: string;
    link?: string;
    coupon?: string;
  }>({ type: 'none' });
  const [isFinalActionModalOpen, setIsFinalActionModalOpen] = useState(false);
  const [finalActionType, setFinalActionType] = useState<'none' | 'image' | 'coupon'>('none');
  const [finalActionImage, setFinalActionImage] = useState<string>('');
  const [finalActionLink, setFinalActionLink] = useState<string>('');
  const [finalActionCoupon, setFinalActionCoupon] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBackgroundUploadModalOpen, setIsBackgroundUploadModalOpen] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(4);
  const [isQrCodeVisible, setIsQrCodeVisible] = useState(true);
  const [isQrDescriptionVisible, setIsQrDescriptionVisible] = useState(true);
  const [isLiveIndicatorVisible, setIsLiveIndicatorVisible] = useState(true);
  const [isParticipantCountVisible, setIsParticipantCountVisible] = useState(true);
  const [isParticipantListVisible, setIsParticipantListVisible] = useState(true);
  const [isParticipantSettingsVisible, setIsParticipantSettingsVisible] = useState(false);
  const [isParticipantNameVisible, setIsParticipantNameVisible] = useState(true);
  const [isParticipantStatusVisible, setIsParticipantStatusVisible] = useState(true);
  const [isParticipantActionsVisible, setIsParticipantActionsVisible] = useState(true);
  const [isParticipantVideoVisible, setIsParticipantVideoVisible] = useState(true);
  const [isParticipantAudioVisible, setIsParticipantAudioVisible] = useState(true);
  const [isParticipantShareVisible, setIsParticipantShareVisible] = useState(true);
  const [isParticipantRemoveVisible, setIsParticipantRemoveVisible] = useState(true);
  const [isParticipantMuteVisible, setIsParticipantMuteVisible] = useState(true);
  const [isParticipantDeafenVisible, setIsParticipantDeafenVisible] = useState(true);
  const [isParticipantKickVisible, setIsParticipantKickVisible] = useState(true);
  const [isParticipantBanVisible, setIsParticipantBanVisible] = useState(true);
  const [isParticipantPromoteVisible, setIsParticipantPromoteVisible] = useState(true);
  const [isParticipantDemoteVisible, setIsParticipantDemoteVisible] = useState(true);
  const [isParticipantGrantControlVisible, setIsParticipantGrantControlVisible] = useState(true);
  const [isParticipantRevokeControlVisible, setIsParticipantRevokeControlVisible] = useState(true);
  const [isParticipantGrantAccessVisible, setIsParticipantGrantAccessVisible] = useState(true);
  const [isParticipantRevokeAccessVisible, setIsParticipantRevokeAccessVisible] = useState(true);
  const [isParticipantGrantAdminVisible, setIsParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible, setIsParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible, setIsParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible, setIsParticipantRevokeOwnerVisible] = useState(true);
  const [isParticipantGrantModeratorVisible, setIsParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible, setIsParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantEditorVisible, setIsParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible, setIsParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantViewerVisible, setIsParticipantGrantViewerVisible] = useState(true);
  const [isParticipantRevokeViewerVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSupporterVisible] = useState(true);
  const [isParticipantRevokeSupporterVisible] = useState(true);
  const [isParticipantGrantPatronVisible] = useState(true);
  const [isParticipantRevokePatronVisible] = useState(true);
  const [isParticipantGrantSponsorVisible] = useState(true);
  const [isParticipantRevokeSponsorVisible] = useState(true);
  const [isParticipantGrantPartnerVisible] = useState(true);
  const [isParticipantRevokePartnerVisible] = useState(true);
  const [isParticipantGrantEmployeeVisible] = useState(true);
  const [isParticipantRevokeEmployeeVisible] = useState(true);
  const [isParticipantGrantContractorVisible] = useState(true);
  const [isParticipantRevokeContractorVisible] = useState(true);
  const [isParticipantGrantVolunteerVisible] = useState(true);
  const [isParticipantRevokeVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [isParticipantMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantSponsorVisible] = useState(true);
  const [isParticipantPartnerVisible] = useState(true);
  const [isParticipantEmployeeVisible] = useState(true);
  const [isParticipantContractorVisible] = useState(true);
  const [isParticipantVolunteerVisible] = useState(true);
  const [isParticipantInternVisible] = useState(true);
  const [isParticipantTraineeVisible] = useState(true);
  const [isParticipantApprenticeVisible] = useState(true);
  const [isParticipantStudentVisible] = useState(true);
  const [isParticipantTeacherVisible] = useState(true);
  const [isParticipantProfessorVisible] = useState(true);
  const [isParticipantAlumniVisible] = useState(true);
  const [isParticipantGuestVisible] = useState(true);
  const [isParticipantVisitorVisible] = useState(true);
  const [isParticipantUserVisible] = useState(true);
  const [
    isParticipantRevokeVisitorVisible
  ] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');

    if (storedSessionId) {
      setSessionId(storedSessionId);
      fetchSessionData(storedSessionId);
    } else {
      startNewSession();
    }
  }, []);

  
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
      setQrCode(`${window.location.origin}/join/${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (qrCode) {
      generateQrCode(qrCode);
    }
  }, [qrCode]);

  useEffect(() => {
    if (session) {
      setSessionName(session.name || '');
      setParticipants(session.participants || []);
      setBackgroundImage(session.backgroundImage || null);
      setSelectedBackgroundColor(session.backgroundColor || '#000000');
      setQrCodePosition(session.qrCodePosition || { x: 20, y: 20, width: 120, height: 120 });
      setQrDescriptionPosition(session.qrDescriptionPosition || { x: 20, y: 160, width: 120, height: 40 });
      setQrCodeDescription(session.qrCodeDescription || 'Acesse com o QR Code');
      setSelectedFont(session.font || 'Arial');
      setSelectedTextColor(session.textColor || '#ffffff');
      setQrDescriptionFontSize(session.fontSize || 14);
      setIsQrCodeVisible(session.isQrCodeVisible !== undefined ? session.isQrCodeVisible : true);
      setIsQrDescriptionVisible(session.isQrDescriptionVisible !== undefined ? session.isQrDescriptionVisible : true);
      setIsLiveIndicatorVisible(session.isLiveIndicatorVisible !== undefined ? session.isLiveIndicatorVisible : true);
      setIsParticipantCountVisible(session.isParticipantCountVisible !== undefined ? session.isParticipantCountVisible : true);
      setIsParticipantListVisible(session.isParticipantListVisible !== undefined ? session.isParticipantListVisible : true);
      setIsParticipantSettingsVisible(session.isParticipantSettingsVisible !== undefined ? session.isParticipantSettingsVisible : false);
      setIsParticipantNameVisible(session.isParticipantNameVisible !== undefined ? session.isParticipantNameVisible : true);
      setIsParticipantStatusVisible(session.isParticipantStatusVisible !== undefined ? session.isParticipantStatusVisible : true);
      setIsParticipantActionsVisible(session.isParticipantActionsVisible !== undefined ? session.isParticipantActionsVisible : true);
      setIsParticipantVideoVisible(session.isParticipantVideoVisible !== undefined ? session.isParticipantVideoVisible : true);
      setIsParticipantAudioVisible(session.isParticipantAudioVisible !== undefined ? session.isParticipantAudioVisible : true);
      setIsParticipantShareVisible(session.isParticipantShareVisible !== undefined ? session.isParticipantShareVisible : true);
      setIsParticipantRemoveVisible(session.isParticipantRemoveVisible !== undefined ? session.isParticipantRemoveVisible : true);
      setIsParticipantMuteVisible(session.isParticipantMuteVisible !== undefined ? session.isParticipantMuteVisible : true);
      setIsParticipantDeafenVisible(session.isParticipantDeafenVisible !== undefined ? session.isParticipantDeafenVisible : true);
      setIsParticipantKickVisible(session.isParticipantKickVisible !== undefined ? session.isParticipantKickVisible : true);
      setIsParticipantBanVisible(session.isParticipantBanVisible !== undefined ? session.isParticipantBanVisible : true);
      setIsParticipantPromoteVisible(session.isParticipantPromoteVisible !== undefined ? session.isParticipantPromoteVisible : true);
      setIsParticipantDemoteVisible(session.isParticipantDemoteVisible !== undefined ? session.isParticipantDemoteVisible : true);
      setIsParticipantGrantControlVisible(session.isParticipantGrantControlVisible !== undefined ? session.isParticipantGrantControlVisible : true);
      setIsParticipantRevokeControlVisible(session.isParticipantRevokeControlVisible !== undefined ? session.isParticipantRevokeControlVisible : true);
      setIsParticipantGrantAccessVisible(session.isParticipantGrantAccessVisible !== undefined ? session.isParticipantGrantAccessVisible : true);
      setIsParticipantRevokeAccessVisible(session.isParticipantRevokeAccessVisible !== undefined ? session.isParticipantRevokeAccessVisible : true);
      setIsParticipantGrantAdminVisible(session.isParticipantGrantAdminVisible !== undefined ? session.isParticipantGrantAdminVisible : true);
      setIsParticipantRevokeAdminVisible(session.isParticipantRevokeAdminVisible !== undefined ? session.isParticipantRevokeAdminVisible : true);
      setIsParticipantGrantOwnerVisible(session.isParticipantGrantOwnerVisible !== undefined ? session.isParticipantGrantOwnerVisible : true);
      setIsParticipantRevokeOwnerVisible(session.isParticipantRevokeOwnerVisible !== undefined ? session.isParticipantRevokeOwnerVisible : true);
      setIsParticipantGrantModeratorVisible(session.isParticipantGrantModeratorVisible !== undefined ? session.isParticipantGrantModeratorVisible : true);
      setIsParticipantRevokeModeratorVisible(session.isParticipantRevokeModeratorVisible !== undefined ? session.isParticipantRevokeModeratorVisible : true);
      setIsParticipantGrantEditorVisible(session.isParticipantGrantEditorVisible !== undefined ? session.isParticipantGrantEditorVisible : true);
      setIsParticipantRevokeEditorVisible(session.isParticipantRevokeEditorVisible !== undefined ? session.isParticipantRevokeEditorVisible : true);
      
      setIsParticipantGrantViewerVisible(session.isParticipantGrantViewerVisible !== undefined ? session.isParticipantGrantViewerVisible : true);
      setIsParticipantRevokeViewerVisible(session.isParticipantRevokeViewerVisible !== undefined ? session.isParticipantRevokeViewerVisible : true);
      setIsParticipantGrantContributorVisible(session.isParticipantGrantContributorVisible !== undefined ? session.isParticipantGrantContributorVisible : true);
      setIsParticipantRevokeContributorVisible(session.isParticipantRevokeContributorVisible !== undefined ? session.isParticipantRevokeContributorVisible : true);
      setIsParticipantGrantCommenterVisible(session.isParticipantGrantCommenterVisible !== undefined ? session.isParticipantGrantCommenterVisible : true);
      setIsParticipantRevokeCommenterVisible(session.isParticipantRevokeCommenterVisible !== undefined ? session.isParticipantRevokeCommenterVisible : true);
      setIsParticipantGrantFollowerVisible(session.isParticipantGrantFollowerVisible !== undefined ? session.isParticipantGrantFollowerVisible : true);
      setIsParticipantRevokeFollowerVisible(session.isParticipantRevokeFollowerVisible !== undefined ? session.isParticipantRevokeFollowerVisible : true);
      setIsParticipantGrantSubscriberVisible(session.isParticipantGrantSubscriberVisible !== undefined ? session.isParticipantGrantSubscriberVisible : true);
      setIsParticipantRevokeSubscriberVisible(session.isParticipantRevokeSubscriberVisible !== undefined ? session.isParticipantRevokeSubscriberVisible : true);
      setIsParticipantGrantMemberVisible(session.isParticipantGrantMemberVisible !== undefined ? session.isParticipantGrantMemberVisible : true);
      setIsParticipantRevokeMemberVisible(session.isParticipantRevokeMemberVisible !== undefined ? session.isParticipantRevokeMemberVisible : true);
      setIsParticipantGrantSupporterVisible(session.isParticipantGrantSupporterVisible !== undefined ? session.isParticipantGrantSupporterVisible : true);
      setIsParticipantRevokeSupporterVisible(session.isParticipantRevokeSupporterVisible !== undefined ? session.isParticipantRevokeSupporterVisible : true);
      setIsParticipantGrantPatronVisible(session.isParticipantGrantPatronVisible !== undefined ? session.isParticipantGrantPatronVisible : true);
      setIsParticipantRevokePatronVisible(session.isParticipantRevokePatronVisible !== undefined ? session.isParticipantRevokePatronVisible : true);
      setIsParticipantGrantSponsorVisible(session.isParticipantGrantSponsorVisible !== undefined ? session.isParticipantGrantSponsorVisible : true);
      setIsParticipantRevokeSponsorVisible(session.isParticipantRevokeSponsorVisible !== undefined ? session.isParticipantRevokeSponsorVisible : true);
      setIsParticipantGrantPartnerVisible(session.isParticipantGrantPartnerVisible !== undefined ? session.isParticipantGrantPartnerVisible : true);
      setIsParticipantRevokePartnerVisible(session.isParticipantRevokePartnerVisible !== undefined ? session.isParticipantRevokePartnerVisible : true);
      setIsParticipantGrantEmployeeVisible(session.isParticipantGrantEmployeeVisible !== undefined ? session.isParticipantGrantEmployeeVisible : true);
      setIsParticipantRevokeEmployeeVisible(session.isParticipantRevokeEmployeeVisible !== undefined ? session.isParticipantRevokeEmployeeVisible : true);
      setIsParticipantGrantContractorVisible(session.isParticipantGrantContractorVisible !== undefined ? session.isParticipantGrantContractorVisible : true);
      setIsParticipantRevokeContractorVisible(session.isParticipantRevokeContractorVisible !== undefined ? session.isParticipantRevokeContractorVisible : true);
      setIsParticipantGrantVolunteerVisible(session.isParticipantGrantVolunteerVisible !== undefined ? session.isParticipantGrantVolunteerVisible : true);
      setIsParticipantRevokeVolunteerVisible(session.isParticipantRevokeVolunteerVisible !== undefined ? session.isParticipantRevokeVolunteerVisible : true);
      setIsParticipantGrantInternVisible(session.isParticipantGrantInternVisible !== undefined ? session.isParticipantGrantInternVisible : true);
      setIsParticipantRevokeInternVisible(session.isParticipantRevokeInternVisible !== undefined ? session.isParticipantRevokeInternVisible : true);
      setIsParticipantGrantTraineeVisible(session.isParticipantGrantTraineeVisible !== undefined ? session.isParticipantGrantTraineeVisible : true);
      setIsParticipantRevokeTraineeVisible(session.isParticipantRevokeTraineeVisible !== undefined ? session.isParticipantRevokeTraineeVisible : true);
      setIsParticipantGrantApprenticeVisible(session.isParticipantGrantApprenticeVisible !== undefined ? session.isParticipantGrantApprenticeVisible : true);
      setIsParticipantRevokeApprenticeVisible(session.isParticipantRevokeApprenticeVisible !== undefined ? session.isParticipantRevokeApprenticeVisible : true);
      setIsParticipantGrantStudentVisible(session.isParticipantGrantStudentVisible !== undefined ? session.isParticipantGrantStudentVisible : true);
      setIsParticipantRevokeStudentVisible(session.isParticipantRevokeStudentVisible !== undefined ? session.isParticipantRevokeStudentVisible : true);
      setIsParticipantGrantTeacherVisible(session.isParticipantTeacherVisible !== undefined ? session.isParticipantTeacherVisible : true);
      setIsParticipantRevokeTeacherVisible(session.isParticipantRevokeTeacherVisible !== undefined ? session.isParticipantRevokeTeacherVisible : true);
      setIsParticipantGrantProfessorVisible(session.isParticipantProfessorVisible !== undefined ? session.isParticipantProfessorVisible : true);
      setIsParticipantRevokeProfessorVisible(session.isParticipantRevokeProfessorVisible !== undefined ? session.isParticipantRevokeProfessorVisible : true);
      setIsParticipantGrantAlumniVisible(session.isParticipantAlumniVisible !== undefined ? session.isParticipantAlumniVisible : true);
      setIsParticipantRevokeAlumniVisible(session.isParticipantRevokeAlumniVisible !== undefined ? session.isParticipantRevokeAlumniVisible : true);
      setIsParticipantGrantGuestVisible(session.isParticipantGuestVisible !== undefined ? session.isParticipantGuestVisible : true);
      setIsParticipantRevokeGuestVisible(session.isParticipantRevokeGuestVisible !== undefined ? session.isParticipantRevokeGuestVisible : true);
      setIsParticipantGrantVisitorVisible(session.isParticipantVisitorVisible !== undefined ? session.isParticipantVisitorVisible : true);
      setIsParticipantRevokeVisitorVisible(session.isParticipantRevokeVisitorVisible !== undefined ? session.isParticipantRevokeVisitorVisible : true);
      setIsParticipantGrantUserVisible(session.isParticipantUserVisible !== undefined ? session.isParticipantUserVisible : true);
      setIsParticipantRevokeUserVisible(session.isParticipantRevokeUserVisible !== undefined ? session.isParticipantRevokeUserVisible : true);
    }
  }, [session]);

  const fetchSessionData = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const sessionData = await getSession(sessionId);
      setSession(sessionData);
    } catch (error) {
      console.error("Failed to fetch session data:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar sessão",
        description: "Não foi possível carregar os dados da sessão. Por favor, tente novamente."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = async () => {
    setIsLoading(true);
    try {
      const newSessionId = generateRandomId();
      const newSession = await createSession(newSessionId);
      setSessionId(newSessionId);
      setSession(newSession);
      setSessionName(newSession.name || '');
      toast({
        title: "Sessão iniciada",
        description: "Uma nova sessão foi iniciada com sucesso."
      });
    } catch (error) {
      console.error("Failed to create a new session:", error);
      toast({
        variant: "destructive",
        title: "Erro ao iniciar sessão",
        description: "Não foi possível iniciar uma nova sessão. Por favor, tente novamente."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    setIsEnding(true);
    try {
      if (sessionId) {
        await endSession(sessionId);
        localStorage.removeItem('sessionId');
        navigate('/');
        toast({
          title: "Sessão encerrada",
          description: "A sessão foi encerrada e os dados foram removidos."
        });
      }
    } catch (error) {
      console.error("Failed to end session:", error);
      toast({
        variant: "destructive",
        title: "Erro ao encerrar sessão",
        description: "Não foi possível encerrar a sessão. Por favor, tente novamente."
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleSessionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSessionName(e.target.value);
  };

  const handleUpdateSessionName = async () => {
    if (sessionId) {
      try {
        await updateSession(sessionId, { name: sessionName });
        setSession(prevSession => ({ ...prevSession, name: sessionName }));
        toast({
          title: "Sessão atualizada",
          description: "O nome da sessão foi atualizado com sucesso."
        });
      } catch (error) {
        console.error("Failed to update session name:", error);
        toast({
          variant: "destructive",
          title: "Erro ao atualizar sessão",
          description: "Não foi possível atualizar o nome da sessão. Por favor, tente novamente."
        });
      }
    }
  };

  const generateQrCode = async (text: string) => {
    try {
      const svg = await QRCode.toString(text, { type: 'svg' });
      setQrCodeSvg(svg);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar o QR Code. Por favor, tente novamente."
      });
    }
  };

  const handleCopySessionLink = () => {
    if (sessionId) {
      const sessionLink = `${window.location.origin}/join/${sessionId}`;
      navigator.clipboard.writeText(sessionLink)
        .then(() => {
          toast({
            title: "Link copiado",
            description: "O link da sessão foi copiado para a área de transferência."
          });
        })
        .catch(err => {
          console.error("Failed to copy session link:", err);
          toast({
            variant: "destructive",
            title: "Erro ao copiar link",
            description: "Não foi possível copiar o link da sessão. Por favor, tente novamente."
          });
        });
    }
  };

  const handleToggleQrCodeVisibility = () => {
    setIsQrCodeVisible(!isQrCodeVisible);
    updateSession(sessionId, { isQrCodeVisible: !isQrCodeVisible });
  };

  const handleToggleQrDescriptionVisibility = () => {
    setIsQrDescriptionVisible(!isQrDescriptionVisible);
    updateSession(sessionId, { isQrDescriptionVisible: !isQrDescriptionVisible });
  };

  const handleToggleLiveIndicatorVisibility = () => {
    setIsLiveIndicatorVisible(!isLiveIndicatorVisible);
    updateSession(sessionId, { isLiveIndicatorVisible: !isLiveIndicatorVisible });
  };

  const handleToggleParticipantCountVisibility = () => {
    setIsParticipantCountVisible(!isParticipantCountVisible);
    updateSession(sessionId, { isParticipantCountVisible: !isParticipantCountVisible });
  };

  const handleToggleParticipantListVisibility = () => {
    setIsParticipantListVisible(!isParticipantListVisible);
    updateSession(sessionId, { isParticipantListVisible: !isParticipantListVisible });
  };

  const handleToggleParticipantSettingsVisibility = () => {
    setIsParticipantSettingsVisible(!isParticipantSettingsVisible);
    updateSession(sessionId, { isParticipantSettingsVisible: !isParticipantSettingsVisible });
  };

  const handleToggleParticipantNameVisibility = () => {
    setIsParticipantNameVisible(!isParticipantNameVisible);
    updateSession(sessionId, { isParticipantNameVisible: !isParticipantNameVisible });
  };

  const handleToggleParticipantStatusVisibility = () => {
    setIsParticipantStatusVisible(!isParticipantStatusVisible);
    updateSession(sessionId, { isParticipantStatusVisible: !isParticipantStatusVisible });
  };

  const handleToggleParticipantActionsVisibility = () => {
    setIsParticipantActionsVisible(!isParticipantActionsVisible);
    updateSession(sessionId, { isParticipantActionsVisible: !isParticipantActionsVisible });
  };

  const handleToggleParticipantVideoVisibility = () => {
    setIsParticipantVideoVisible(!isParticipantVideoVisible);
    updateSession(sessionId, { isParticipantVideoVisible: !isParticipantVideoVisible });
  };

  const handleToggleParticipantAudioVisibility = () => {
    setIsParticipantAudioVisible(!isParticipantAudioVisible);
    updateSession(sessionId, { isParticipantAudioVisible: !isParticipantAudioVisible });
  };

  const handleToggleParticipantShareVisibility = () => {
    setIsParticipantShareVisible(!isParticipantShareVisible);
    updateSession(sessionId, { isParticipantShareVisible: !isParticipantShareVisible });
  };

  const handleToggleParticipantRemoveVisibility = () => {
    setIsParticipantRemoveVisible(!isParticipantRemoveVisible);
    updateSession(sessionId, { isParticipantRemoveVisible: !isParticipantRemoveVisible });
  };

  const handleToggleParticipantMuteVisibility = () => {
    setIsParticipantMuteVisible(!isParticipantMuteVisible);
    updateSession(sessionId, { isParticipantMuteVisible: !isParticipantMuteVisible });
  };

  const handleToggleParticipantDeafenVisibility = () => {
    setIsParticipantDeafenVisible(!isParticipantDeafenVisible);
    updateSession(sessionId, { isParticipantDeafenVisible: !isParticipantDeafenVisible });
  };

  const handleToggleParticipantKickVisibility = () => {
    setIsParticipantKickVisible(!isParticipantKickVisible);
    updateSession(sessionId, { isParticipantKickVisible: !isParticipantKickVisible });
  };

  const handleToggleParticipantBanVisibility = () => {
    setIsParticipantBanVisible(!isParticipantBanVisible);
    updateSession(sessionId, { isParticipantBanVisible: !isParticipantBanVisible });
  };

  const handleToggleParticipantPromoteVisibility = () => {
    setIsParticipantPromoteVisible(!isParticipantPromoteVisible);
    updateSession(sessionId, { isParticipantPromoteVisible: !isParticipantPromoteVisible });
  };

  const handleToggleParticipantDemoteVisibility = () => {
    setIsParticipantDemoteVisible(!isParticipantDemoteVisible);
    updateSession(sessionId, { isParticipantDemoteVisible: !isParticipantDemoteVisible });
  };

  const handleToggleParticipantGrantControlVisibility = () => {
    setIsParticipantGrantControlVisible(!isParticipantGrantControlVisible);
    updateSession(sessionId, { isParticipantGrantControlVisible: !isParticipantGrantControlVisible });
  };

  const handleToggleParticipantRevokeControlVisibility = () => {
    setIsParticipantRevokeControlVisible(!isParticipantRevokeControlVisible);
    updateSession(sessionId, { isParticipantRevokeControlVisible: !isParticipantRevokeControlVisible });
  };

  const handleToggleParticipantGrantAccessVisibility = () => {
    setIsParticipantGrantAccessVisible(!isParticipantGrantAccessVisible);
    updateSession(sessionId, { isParticipantGrantAccessVisible: !isParticipantGrantAccessVisible });
  };

  const handleToggleParticipantRevokeAccessVisibility = () => {
    setIsParticipantRevokeAccessVisible(!isParticipantRevokeAccessVisible);
    updateSession(sessionId, { isParticipantRevokeAccessVisible: !isParticipantRevokeAccessVisible });
  };

  const handleToggleParticipantGrantAdminVisibility =
