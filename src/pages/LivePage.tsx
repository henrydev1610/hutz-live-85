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
  const [isParticipantRevokeViewerVisible, setIsParticipantRevokeViewerVisible] = useState(true);
  const [isParticipantGrantContributorVisible, setIsParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible, setIsParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantCommenterVisible, setIsParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible, setIsParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantFollowerVisible, setIsParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible, setIsParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible, setIsParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible, setIsParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantMemberVisible, setIsParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible, setIsParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSupporterVisible, setIsParticipantGrantSupporterVisible] = useState(true);
  const [isParticipantRevokeSupporterVisible, setIsParticipantRevokeSupporterVisible] = useState(true);
  const [isParticipantGrantPatronVisible, setIsParticipantGrantPatronVisible] = useState(true);
  const [isParticipantRevokePatronVisible, setIsParticipantRevokePatronVisible] = useState(true);
  const [isParticipantGrantSponsorVisible, setIsParticipantGrantSponsorVisible] = useState(true);
  const [isParticipantRevokeSponsorVisible, setIsParticipantRevokeSponsorVisible] = useState(true);
  const [isParticipantGrantPartnerVisible, setIsParticipantGrantPartnerVisible] = useState(true);
  const [isParticipantRevokePartnerVisible, setIsParticipantRevokePartnerVisible] = useState(true);
  const [isParticipantGrantEmployeeVisible, setIsParticipantGrantEmployeeVisible] = useState(true);
  const [isParticipantRevokeEmployeeVisible, setIsParticipantRevokeEmployeeVisible] = useState(true);
  const [isParticipantGrantContractorVisible, setIsParticipantGrantContractorVisible] = useState(true);
  const [isParticipantRevokeContractorVisible, setIsParticipantRevokeContractorVisible] = useState(true);
  const [isParticipantGrantVolunteerVisible, setIsParticipantGrantVolunteerVisible] = useState(true);
  const [isParticipantRevokeVolunteerVisible, setIsParticipantRevokeVolunteerVisible] = useState(true);
  const [isParticipantGrantInternVisible, setIsParticipantGrantInternVisible] = useState(true);
  const [isParticipantRevokeInternVisible, setIsParticipantRevokeInternVisible] = useState(true);
  const [isParticipantGrantTraineeVisible, setIsParticipantGrantTraineeVisible] = useState(true);
  const [isParticipantRevokeTraineeVisible, setIsParticipantRevokeTraineeVisible] = useState(true);
  const [isParticipantGrantApprenticeVisible, setIsParticipantGrantApprenticeVisible] = useState(true);
  const [isParticipantRevokeApprenticeVisible, setIsParticipantRevokeApprenticeVisible] = useState(true);
  const [isParticipantGrantStudentVisible, setIsParticipantGrantStudentVisible] = useState(true);
  const [isParticipantRevokeStudentVisible, setIsParticipantRevokeStudentVisible] = useState(true);
  const [isParticipantGrantTeacherVisible, setIsParticipantGrantTeacherVisible] = useState(true);
  const [isParticipantRevokeTeacherVisible, setIsParticipantRevokeTeacherVisible] = useState(true);
  const [isParticipantGrantProfessorVisible, setIsParticipantGrantProfessorVisible] = useState(true);
  const [isParticipantRevokeProfessorVisible, setIsParticipantRevokeProfessorVisible] = useState(true);
  const [isParticipantGrantAlumniVisible, setIsParticipantGrantAlumniVisible] = useState(true);
  const [isParticipantRevokeAlumniVisible, setIsParticipantRevokeAlumniVisible] = useState(true);
  const [isParticipantGrantGuestVisible, setIsParticipantGrantGuestVisible] = useState(true);
  const [isParticipantRevokeGuestVisible, setIsParticipantRevokeGuestVisible] = useState(true);
  const [isParticipantGrantVisitorVisible, setIsParticipantGrantVisitorVisible] = useState(true);
  const [isParticipantRevokeVisitorVisible] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);
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
  const [isParticipantGrantInternVisible] = useState(true);
  const [isParticipantRevokeInternVisible] = useState(true);
  const [isParticipantGrantTraineeVisible] = useState(true);
  const [isParticipantRevokeTraineeVisible] = useState(true);
  const [isParticipantGrantApprenticeVisible] = useState(true);
  const [isParticipantRevokeApprenticeVisible] = useState(true);
  const [isParticipantGrantStudentVisible] = useState(true);
  const [isParticipantRevokeStudentVisible] = useState(true);
  const [isParticipantGrantTeacherVisible] = useState(true);
  const [isParticipantRevokeTeacherVisible] = useState(true);
  const [isParticipantGrantProfessorVisible] = useState(true);
  const [isParticipantRevokeProfessorVisible] = useState(true);
  const [isParticipantGrantAlumniVisible] = useState(true);
  const [isParticipantRevokeAlumniVisible] = useState(true);
  const [isParticipantGrantGuestVisible] = useState(true);
  const [isParticipantRevokeGuestVisible] = useState(true);
  const [isParticipantGrantVisitorVisible] = useState(true);
  const [isParticipantRevokeVisitorVisible] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);
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
  const [isParticipantGrantInternVisible] = useState(true);
  const [isParticipantRevokeInternVisible] = useState(true);
  const [isParticipantGrantTraineeVisible] = useState(true);
  const [isParticipantRevokeTraineeVisible] = useState(true);
  const [isParticipantGrantApprenticeVisible] = useState(true);
  const [isParticipantRevokeApprenticeVisible] = useState(true);
  const [isParticipantGrantStudentVisible] = useState(true);
  const [isParticipantRevokeStudentVisible] = useState(true);
  const [isParticipantGrantTeacherVisible] = useState(true);
  const [isParticipantRevokeTeacherVisible] = useState(true);
  const [isParticipantGrantProfessorVisible] = useState(true);
  const [isParticipantRevokeProfessorVisible] = useState(true);
  const [isParticipantGrantAlumniVisible] = useState(true);
  const [isParticipantRevokeAlumniVisible] = useState(true);
  const [isParticipantGrantGuestVisible] = useState(true);
  const [isParticipantRevokeGuestVisible] = useState(true);
  const [isParticipantGrantVisitorVisible] = useState(true);
  const [isParticipantRevokeVisitorVisible] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);
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
  const [isParticipantGrantInternVisible] = useState(true);
  const [isParticipantRevokeInternVisible] = useState(true);
  const [isParticipantGrantTraineeVisible] = useState(true);
  const [isParticipantRevokeTraineeVisible] = useState(true);
  const [isParticipantGrantApprenticeVisible] = useState(true);
  const [isParticipantRevokeApprenticeVisible] = useState(true);
  const [isParticipantGrantStudentVisible] = useState(true);
  const [isParticipantRevokeStudentVisible] = useState(true);
  const [isParticipantGrantTeacherVisible] = useState(true);
  const [isParticipantRevokeTeacherVisible] = useState(true);
  const [isParticipantGrantProfessorVisible] = useState(true);
  const [isParticipantRevokeProfessorVisible] = useState(true);
  const [isParticipantGrantAlumniVisible] = useState(true);
  const [isParticipantRevokeAlumniVisible] = useState(true);
  const [isParticipantGrantGuestVisible] = useState(true);
  const [isParticipantRevokeGuestVisible] = useState(true);
  const [isParticipantGrantVisitorVisible] = useState(true);
  const [isParticipantRevokeVisitorVisible] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);
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
  const [isParticipantGrantInternVisible] = useState(true);
  const [isParticipantRevokeInternVisible] = useState(true);
  const [isParticipantGrantTraineeVisible] = useState(true);
  const [isParticipantRevokeTraineeVisible] = useState(true);
  const [isParticipantGrantApprenticeVisible] = useState(true);
  const [isParticipantRevokeApprenticeVisible] = useState(true);
  const [isParticipantGrantStudentVisible] = useState(true);
  const [isParticipantRevokeStudentVisible] = useState(true);
  const [isParticipantGrantTeacherVisible] = useState(true);
  const [isParticipantRevokeTeacherVisible] = useState(true);
  const [isParticipantGrantProfessorVisible] = useState(true);
  const [isParticipantRevokeProfessorVisible] = useState(true);
  const [isParticipantGrantAlumniVisible] = useState(true);
  const [isParticipantRevokeAlumniVisible] = useState(true);
  const [isParticipantGrantGuestVisible] = useState(true);
  const [isParticipantRevokeGuestVisible] = useState(true);
  const [isParticipantGrantVisitorVisible] = useState(true);
  const [isParticipantRevokeVisitorVisible] = useState(true);
  const [isParticipantGrantUserVisible] = useState(true);
  const [isParticipantRevokeUserVisible] = useState(true);
  const [isParticipantGrantMemberVisible] = useState(true);
  const [isParticipantRevokeMemberVisible] = useState(true);
  const [isParticipantGrantSubscriberVisible] = useState(true);
  const [isParticipantRevokeSubscriberVisible] = useState(true);
  const [isParticipantGrantFollowerVisible] = useState(true);
  const [isParticipantRevokeFollowerVisible] = useState(true);
  const [isParticipantGrantCommenterVisible] = useState(true);
  const [isParticipantRevokeCommenterVisible] = useState(true);
  const [isParticipantGrantContributorVisible] = useState(true);
  const [isParticipantRevokeContributorVisible] = useState(true);
  const [isParticipantGrantEditorVisible] = useState(true);
  const [isParticipantRevokeEditorVisible] = useState(true);
  const [isParticipantGrantModeratorVisible] = useState(true);
  const [isParticipantRevokeModeratorVisible] = useState(true);
  const [isParticipantGrantAdminVisible] = useState(true);
  const [isParticipantRevokeAdminVisible] = useState(true);
  const [isParticipantGrantOwnerVisible] = useState(true);
  const [isParticipantRevokeOwnerVisible] = useState(true);
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
  const [
