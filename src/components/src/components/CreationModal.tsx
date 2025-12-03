import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
}

/**
 * TABS:
 * - PLOT
 * - CHARACTER
 * - RULES
 * - APPEARANCE  ✅ NEW
 */
type TabType = "PLOT" | "CHARACTER" | "RULES" | "APPEARANCE";

const CreationModal: React.FC<CreationModalProps> = ({
    isOpen,
    onClose,
    onSave,
}) => {
    // ACTIVE TAB  (now includes "APPEARANCE")
    const [activeTab, setActiveTab] = useState<TabType>("PLOT");

    // --- PLOT TAB ---
    const [summary, setSummary] = useState("");
    const [worldLore, setWorldLore] = useState("");
    const [openingScene, setOpeningScene] = useState("");

    // --- CHARACTER TAB ---
    const [charName, setCharName] = useState("");
    const [charClass, setCharClass] = useState("");
    const [charBackground, setCharBackground] = useState("");

    // --- RULES TAB ---
    const [aiInstructions, setAiInstructions] = useState("");
    const [authorsNote, setAuthorsNote] = useState("");

    // --- APPEARANCE TAB (NEW) ---
    const [bgColor, setBgColor] = useState("#000000");

    const handleSave = () => {
        onSave({
            plot: {
                summary,
                worldLore,
                openingScene,
            },
            character: {
                charName,
                charClass,
                charBackground,
            },
            rules: {
                aiInstructions,
                authorsNote,
            },
            appearance: {
                bgColor, // <-- NEW
            },
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        World Customization
                    </DialogTitle>
                </DialogHeader>

                {/* ---------------- TAB SELECTOR ---------------- */}
                <div className="flex gap-2 mt-3 mb-4">
                    <Button
                        variant={activeTab === "PLOT" ? "default" : "secondary"}
                        onClick={() => setActiveTab("PLOT")}
                    >
                        PLOT
                    </Button>

                    <Button
                        variant={
                            activeTab === "CHARACTER" ? "default" : "secondary"
                        }
                        onClick={() => setActiveTab("CHARACTER")}
                    >
                        CHARACTER
                    </Button>

                    <Button
                        variant={activeTab === "RULES" ? "default" : "secondary"}
                        onClick={() => setActiveTab("RULES")}
                    >
                        RULES
                    </Button>

                    {/* NEW TAB BUTTON */}
                    <Button
                        variant={
                            activeTab === "APPEARANCE"
                                ? "default"
                                : "secondary"
                        }
                        onClick={() => setActiveTab("APPEARANCE")}
                    >
                        APPEARANCE
                    </Button>
                </div>

                {/* ---------------- TAB CONTENT ---------------- */}
                <div className="space-y-4">
                    {/* ---------- TAB: PLOT ---------- */}
                    {activeTab === "PLOT" && (
                        <>
                            <Textarea
                                placeholder="Story Summary"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                            />
                            <Textarea
                                placeholder="World Lore"
                                value={worldLore}
                                onChange={(e) => setWorldLore(e.target.value)}
                            />
                            <Textarea
                                placeholder="Opening Scene"
                                value={openingScene}
                                onChange={(e) =>
                                    setOpeningScene(e.target.value)
                                }
                            />
                        </>
                    )}

                    {/* ---------- TAB: CHARACTER ---------- */}
                    {activeTab === "CHARACTER" && (
                        <>
                            <Input
                                placeholder="Character Name"
                                value={charName}
                                onChange={(e) => setCharName(e.target.value)}
                            />
                            <Input
                                placeholder="Class / Role"
                                value={charClass}
                                onChange={(e) => setCharClass(e.target.value)}
                            />
                            <Textarea
                                placeholder="Background"
                                value={charBackground}
                                onChange={(e) =>
                                    setCharBackground(e.target.value)
                                }
                            />
                        </>
                    )}

                    {/* ---------- TAB: RULES ---------- */}
                    {activeTab === "RULES" && (
                        <>
                            <Textarea
                                placeholder="AI Instructions"
                                value={aiInstructions}
                                onChange={(e) =>
                                    setAiInstructions(e.target.value)
                                }
                            />
                            <Textarea
                                placeholder="Author's Note"
                                value={authorsNote}
                                onChange={(e) =>
                                    setAuthorsNote(e.target.value)
                                }
                            />
                        </>
                    )}

                    {/* ---------- TAB: APPEARANCE (NEW) ---------- */}
                    {activeTab === "APPEARANCE" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Background Gradient Color
                            </label>

                            <Input
                                type="color"
                                value={bgColor}
                                onChange={(e) => setBgColor(e.target.value)}
                                className="h-12 w-24 p-1 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-6">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreationModal;
