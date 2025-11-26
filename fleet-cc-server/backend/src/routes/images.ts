import express from 'express'
import { z } from 'zod'
import { ImageVerificationService } from '../services/imageVerification'
import { broadcastImageUpdate } from './realtime'

const router = express.Router()

// Add verified image schema
const addVerifiedImageSchema = z.object({
	imageBuildHash: z.string().min(1),
	imageSignature: z.string().optional(),
	buildId: z.string().optional(),
	gitSha: z.string().optional(),
	buildTimestamp: z.string().optional(), // ISO date string
	verifiedBy: z.string().optional(),
	notes: z.string().optional(),
})

// Mark image as verified schema
const markVerifiedSchema = z.object({
	verifiedBy: z.string().optional(),
	notes: z.string().optional(),
})

/**
 * @swagger
 * /api/images:
 *   get:
 *     summary: Get all images with device counts
 *     description: Returns all images with device counts. Supports filtering by unknown status and active status.
 *     tags: [Images]
 *     parameters:
 *       - in: query
 *         name: includeUnverified
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include unverified images
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only return active images
 *     responses:
 *       200:
 *         description: List of images with device counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Image'
 *                 count:
 *                   type: integer
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const includeUnverified = req.query.includeUnverified !== 'false'
		const activeOnly = req.query.activeOnly !== 'false'

		const images = await imageVerification.getImagesWithDeviceCounts({
			includeUnverified,
			activeOnly,
		})

		res.json({
			images,
			count: images.length,
		})
	} catch (error) {
		console.error('Get images error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/images/{buildHash}:
 *   get:
 *     summary: Get image by build hash with device list
 *     description: Returns image details with list of devices using this image.
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: buildHash
 *         required: true
 *         schema:
 *           type: string
 *         description: Image build hash
 *     responses:
 *       200:
 *         description: Image details with device list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
 *       404:
 *         description: Image not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:buildHash', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const { buildHash } = req.params

		const image = await imageVerification.getImageWithDevices(buildHash)

		if (!image) {
			return res.status(404).json({ error: 'Image not found' })
		}

		res.json(image)
	} catch (error) {
		console.error('Get image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/images:
 *   post:
 *     summary: Add or update a verified image
 *     description: Adds a carputer image to the verified images list, allowing devices running this image to automatically register.
 *     tags: [Images]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageBuildHash
 *             properties:
 *               imageBuildHash:
 *                 type: string
 *               imageSignature:
 *                 type: string
 *               buildId:
 *                 type: string
 *               gitSha:
 *                 type: string
 *               buildTimestamp:
 *                 type: string
 *                 format: date-time
 *                 description: ISO date string
 *               verifiedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Image added/updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 image:
 *                   $ref: '#/components/schemas/Image'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res) => {
	try {
		const data = addVerifiedImageSchema.parse(req.body)
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)

		const image = await imageVerification.addVerifiedImage(
			data.imageBuildHash,
			{
				signature: data.imageSignature,
				buildId: data.buildId,
				gitSha: data.gitSha,
				buildTimestamp: data.buildTimestamp
					? new Date(data.buildTimestamp)
					: undefined,
				verifiedBy: data.verifiedBy || 'admin',
				notes: data.notes,
			}
		)

		// Get full image with device counts for broadcast
		const imageWithCounts =
			await imageVerification.getImagesWithDeviceCounts({
				includeUnverified: true,
				activeOnly: false,
			})
		const fullImage = imageWithCounts.find(
			img => img.image_build_hash === data.imageBuildHash
		)

		// Broadcast image update
		if (fullImage) {
			broadcastImageUpdate(fullImage, {
				title: 'Image Updated',
				message: `Image ${
					fullImage.build_id ||
					fullImage.image_build_hash.substring(0, 8)
				} has been updated`,
			})
		}

		res.status(201).json({
			message: 'Image added/updated successfully',
			image,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Add image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/images/{buildHash}/verify:
 *   patch:
 *     summary: Mark an image as verified
 *     description: Marks an unknown image as verified, allowing devices to auto-authorize. Also auto-authorizes devices using this image.
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: buildHash
 *         required: true
 *         schema:
 *           type: string
 *         description: Image build hash
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verifiedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image marked as verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 image:
 *                   $ref: '#/components/schemas/Image'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Image not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:buildHash/verify', async (req, res) => {
	try {
		const data = markVerifiedSchema.parse(req.body)
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const { buildHash } = req.params

		const image = await imageVerification.markImageAsVerified(buildHash, {
			verifiedBy: data.verifiedBy || 'admin',
			notes: data.notes,
		})

		if (!image) {
			return res.status(404).json({ error: 'Image not found' })
		}

		// Auto-authorize devices using this image
		await prisma.device.updateMany({
			where: {
				image_id: image.id,
				authorized: false,
			},
			data: {
				authorized: true,
				authorized_at: new Date(),
				authorized_by: 'auto',
			},
		})

		// Get full image with device counts for broadcast
		const imagesWithCounts =
			await imageVerification.getImagesWithDeviceCounts({
				includeUnverified: true,
				activeOnly: false,
			})
		const fullImage = imagesWithCounts.find(
			img => img.image_build_hash === buildHash
		)

		// Broadcast image update
		if (fullImage) {
			broadcastImageUpdate(fullImage, {
				title: 'Image Verified',
				message: `Image ${
					fullImage.build_id ||
					fullImage.image_build_hash.substring(0, 8)
				} has been verified`,
			})
		}

		res.json({
			message: 'Image marked as verified successfully',
			image,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: 'Validation error', details: error.errors })
		}
		console.error('Mark image as verified error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

/**
 * @swagger
 * /api/images/{buildHash}:
 *   delete:
 *     summary: Deactivate an image
 *     description: Deactivates an image, preventing new devices from registering with this image. Existing devices are not affected.
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: buildHash
 *         required: true
 *         schema:
 *           type: string
 *         description: Image build hash
 *     responses:
 *       200:
 *         description: Image deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 buildHash:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:buildHash', async (req, res) => {
	try {
		const prisma = req.prisma
		const imageVerification = new ImageVerificationService(prisma)
		const { buildHash } = req.params

		await imageVerification.deactivateImage(buildHash)

		res.json({
			message: 'Image deactivated successfully',
			buildHash,
		})
	} catch (error) {
		console.error('Deactivate image error:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
})

export default router
